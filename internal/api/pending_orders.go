package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"
	"brokerageProject/internal/services"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreatePendingOrder handles POST /api/v1/pending-orders
// Protected endpoint that creates a new pending order
func CreatePendingOrder(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Parse request body
	var req models.CreatePendingOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body: "+err.Error())
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// Normalize symbol for database compatibility
	// Forex pairs (e.g., AUDJPYUSDT → AUDJPY) are stored without USDT suffix
	// Crypto pairs (e.g., BTCUSDT) keep the USDT suffix
	normalizedSymbol := normalizeSymbol(req.Symbol)

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Verify account belongs to user and get user UUID
	var accountUserID int64
	var userUUID uuid.UUID
	err = pool.QueryRow(ctx, `
		SELECT a.user_id, u.id
		FROM accounts a
		JOIN users u ON a.user_id = u.user_id
		WHERE a.id = $1
	`, req.AccountID).Scan(&accountUserID, &userUUID)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
			return
		}
		log.Printf("Failed to verify account ownership: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify account")
		return
	}

	if accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Validate stop-limit orders: Ensure stop price hasn't been breached
	if req.Type == models.OrderExecutionTypeStopLimit {
		priceCache := services.GetGlobalPriceCache()
		currentPrice, err := priceCache.GetPrice(req.Symbol)

		if err == nil {
			// Buy stop-limit: stop price must be ABOVE current market price
			if req.Side == models.OrderSideBuy && currentPrice >= req.TriggerPrice {
				msg := fmt.Sprintf("Buy stop price (%.2f) must be above current market price (%.2f)", req.TriggerPrice, currentPrice)
				respondWithJSONError(w, http.StatusBadRequest, "validation_error", msg)
				return
			}

			// Sell stop-limit: stop price must be BELOW current market price
			if req.Side == models.OrderSideSell && currentPrice <= req.TriggerPrice {
				msg := fmt.Sprintf("Sell stop price (%.2f) must be below current market price (%.2f)", req.TriggerPrice, currentPrice)
				respondWithJSONError(w, http.StatusBadRequest, "validation_error", msg)
				return
			}
		} else {
			// Log warning but allow order placement if price data is unavailable
			log.Printf("Warning: Could not get current price for %s to validate stop-limit: %v", req.Symbol, err)
		}
	}

	// Validate currency balance for SPOT forex pairs ONLY
	// CFD and Futures only require margin (USD/USDT), not the actual currencies
	if req.ProductType == models.ProductTypeSpot {
		// Look up quote currency from instruments table (more reliable than string parsing)
		var quoteCurrency string
		err = pool.QueryRow(ctx,
			`SELECT quote_currency FROM instruments WHERE symbol = $1`,
			normalizedSymbol,
		).Scan(&quoteCurrency)

		if err != nil {
			if err == pgx.ErrNoRows {
				msg := fmt.Sprintf("Symbol %s not found in instruments table", req.Symbol)
				respondWithJSONError(w, http.StatusBadRequest, "invalid_symbol", msg)
				return
			}
			log.Printf("Failed to lookup quote currency for %s: %v", req.Symbol, err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to validate symbol")
			return
		}

		// Check if account has balance in the quote currency
		// IMPORTANT: Treat USD and USDT as equivalent (1:1 peg)
		var quoteBalance float64
		if quoteCurrency == "USD" || quoteCurrency == "USDT" {
			// Sum both USD and USDT balances
			err = pool.QueryRow(ctx,
				`SELECT COALESCE(SUM(amount), 0)
				 FROM balances
				 WHERE account_id = $1 AND currency IN ('USD', 'USDT')`,
				req.AccountID,
			).Scan(&quoteBalance)
		} else {
			// For other currencies, check exact match
			err = pool.QueryRow(ctx,
				`SELECT COALESCE(amount, 0) FROM balances WHERE account_id = $1 AND currency = $2`,
				req.AccountID, quoteCurrency,
			).Scan(&quoteBalance)
		}

		// If no balance exists or balance is zero, reject the order
		if err != nil && err != pgx.ErrNoRows {
			log.Printf("Failed to check balance: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to check balance")
			return
		}

		if quoteBalance <= 0 {
			msg := fmt.Sprintf("SPOT trading %s requires %s balance in your account. Please deposit %s or trade CFD/Futures instead.",
				req.Symbol, quoteCurrency, quoteCurrency)
			respondWithJSONError(w, http.StatusBadRequest, "insufficient_currency", msg)
			return
		}
	}

	// Start a transaction to ensure atomicity
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create pending order")
		return
	}
	defer tx.Rollback(ctx) // Rollback if not committed

	// Generate order number INSIDE the transaction
	var orderNumber string
	err = tx.QueryRow(ctx, "SELECT generate_order_number()").Scan(&orderNumber)
	if err != nil {
		log.Printf("Failed to generate order number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate order number")
		return
	}

	// Set default leverage if not provided
	leverage := req.Leverage
	if leverage < 1 {
		leverage = 1
	}

	// Create pending order with order_number, leverage, and product_type
	orderID := uuid.New()
	_, err = tx.Exec(ctx,
		`INSERT INTO pending_orders (
			id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price, leverage, product_type, status, order_number, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, NOW(), NOW()
		)`,
		orderID, userUUID, req.AccountID, normalizedSymbol, req.Type, req.Side, req.Quantity, req.TriggerPrice, req.LimitPrice, leverage, req.ProductType, orderNumber,
	)
	if err != nil {
		log.Printf("Failed to insert pending order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create pending order")
		return
	}

	// Commit the transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create pending order")
		return
	}

	// Fetch created order
	createdOrder, err := getPendingOrderByID(ctx, pool, orderID, userUUID)
	if err != nil {
		log.Printf("Failed to fetch created pending order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "order created but failed to fetch details")
		return
	}

	// Return created order
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "pending order created successfully",
		"order":   createdOrder,
	})
}

// GetPendingOrders handles GET /api/v1/pending-orders
// Protected endpoint that fetches pending orders for an account
func GetPendingOrders(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Get account ID from query parameter
	accountIDStr := r.URL.Query().Get("account_id")
	if accountIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "account_id is required")
		return
	}

	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid account_id format")
		return
	}

	// Optional product_type filter
	productTypeFilter := r.URL.Query().Get("product_type") // "spot", "cfd", or "futures"

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Verify account belongs to user
	var accountUserID int64
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", accountID).Scan(&accountUserID)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
			return
		}
		log.Printf("Failed to verify account ownership: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify account")
		return
	}

	if accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Build query with optional product_type filter
	// CRITICAL FIX: Only return orders with status = 'pending' (exclude executed, cancelled, failed)
	query := `SELECT id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price,
	                 leverage, product_type, status, executed_at, executed_price, failure_reason, created_at, updated_at, order_number
	          FROM pending_orders
	          WHERE account_id = $1 AND status = 'pending'`

	args := []interface{}{accountID}

	if productTypeFilter != "" {
		query += " AND product_type = $2"
		args = append(args, productTypeFilter)
	}

	query += " ORDER BY created_at DESC"

	// Fetch pending orders
	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		log.Printf("Failed to query pending orders: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch pending orders")
		return
	}
	defer rows.Close()

	// Parse orders
	var orders []models.PendingOrder
	for rows.Next() {
		var order models.PendingOrder
		err := rows.Scan(
			&order.ID, &order.UserID, &order.AccountID, &order.Symbol, &order.Type, &order.Side,
			&order.Quantity, &order.TriggerPrice, &order.LimitPrice, &order.Leverage, &order.ProductType, &order.Status,
			&order.ExecutedAt, &order.ExecutedPrice, &order.FailureReason,
			&order.CreatedAt, &order.UpdatedAt, &order.OrderNumber,
		)
		if err != nil {
			log.Printf("Failed to scan pending order: %v", err)
			continue
		}
		orders = append(orders, order)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Row iteration error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "error processing orders")
		return
	}

	// Return empty array if no orders found
	if orders == nil {
		orders = []models.PendingOrder{}
	}

	// Return orders
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"orders":  orders,
	})
}

// CancelPendingOrder handles DELETE /api/v1/pending-orders
// Protected endpoint that cancels a pending order
func CancelPendingOrder(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Get order ID from query parameter
	orderIDStr := r.URL.Query().Get("id")
	if orderIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "order id is required")
		return
	}

	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid order id format")
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Verify order belongs to user and is still pending
	var orderUserID int64
	var userUUID uuid.UUID
	var orderStatus models.PendingOrderStatus
	err = pool.QueryRow(ctx, `
		SELECT a.user_id, u.id, p.status
		FROM pending_orders p
		JOIN accounts a ON p.account_id = a.id
		JOIN users u ON a.user_id = u.user_id
		WHERE p.id = $1
	`, orderID).Scan(&orderUserID, &userUUID, &orderStatus)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "pending order not found")
			return
		}
		log.Printf("Failed to verify order ownership: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify order")
		return
	}

	if orderUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "order does not belong to user")
		return
	}

	if orderStatus != models.PendingOrderStatusPending {
		// Provide user-friendly error messages based on order status
		var message string
		switch orderStatus {
		case models.PendingOrderStatusExecuted:
			message = "This order has already been executed and cannot be cancelled"
		case models.PendingOrderStatusCancelled:
			message = "This order is already cancelled"
		case models.PendingOrderStatusFailed:
			message = "This order has failed and cannot be cancelled"
		case models.PendingOrderStatusExpired:
			message = "This order has expired and cannot be cancelled"
		default:
			message = fmt.Sprintf("Cannot cancel order with status: %s", orderStatus)
		}
		respondWithJSONError(w, http.StatusBadRequest, "invalid_status", message)
		return
	}

	// Cancel the order
	_, err = pool.Exec(ctx,
		`UPDATE pending_orders
		 SET status = 'cancelled', updated_at = NOW()
		 WHERE id = $1`,
		orderID,
	)
	if err != nil {
		log.Printf("Failed to cancel pending order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to cancel order")
		return
	}

	// Fetch cancelled order
	cancelledOrder, err := getPendingOrderByID(ctx, pool, orderID, userUUID)
	if err != nil {
		log.Printf("Failed to fetch cancelled order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "order cancelled but failed to fetch details")
		return
	}

	// Return cancelled order
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "pending order cancelled successfully",
		"order":   cancelledOrder,
	})
}

// Helper function to get pending order by ID
func getPendingOrderByID(ctx context.Context, pool DBQuerier, orderID uuid.UUID, userUUID uuid.UUID) (models.PendingOrder, error) {
	var order models.PendingOrder
	err := pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price,
		        leverage, product_type, status, executed_at, executed_price, failure_reason,
		        created_at, updated_at, order_number
		 FROM pending_orders
		 WHERE id = $1 AND user_id = $2`,
		orderID, userUUID,
	).Scan(
		&order.ID, &order.UserID, &order.AccountID, &order.Symbol, &order.Type, &order.Side,
		&order.Quantity, &order.TriggerPrice, &order.LimitPrice, &order.Leverage, &order.ProductType,
		&order.Status, &order.ExecutedAt, &order.ExecutedPrice, &order.FailureReason,
		&order.CreatedAt, &order.UpdatedAt, &order.OrderNumber,
	)
	if err != nil {
		return order, fmt.Errorf("failed to fetch pending order: %w", err)
	}

	return order, nil
}
