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
)

// CreateOrder handles POST /api/v1/orders
// Creates a new trading order and executes it if it's a market order
func CreateOrder(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	var req models.CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	// Validate
	if req.AmountBase <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "amount_base must be positive")
		return
	}

	// Validate limit/stop prices for respective order types
	if req.Type == models.OrderTypeLimit || req.Type == models.OrderTypeStopLimit {
		if req.LimitPrice == nil || *req.LimitPrice <= 0 {
			respondWithJSONError(w, http.StatusBadRequest, "validation_error", "limit_price is required and must be positive for limit orders")
			return
		}
	}
	if req.Type == models.OrderTypeStop || req.Type == models.OrderTypeStopLimit {
		if req.StopPrice == nil || *req.StopPrice <= 0 {
			respondWithJSONError(w, http.StatusBadRequest, "validation_error", "stop_price is required and must be positive for stop orders")
			return
		}
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second) // Increased timeout for execution
	defer cancel()

	// Verify account belongs to user
	var accountUserID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", req.AccountID).Scan(&accountUserID)
	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
		return
	}
	if accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Verify instrument exists and is tradeable
	var isTradeable bool
	err = pool.QueryRow(ctx, "SELECT is_tradeable FROM instruments WHERE symbol = $1", req.Symbol).Scan(&isTradeable)
	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "instrument not found")
		return
	}
	if !isTradeable {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "instrument is not tradeable")
		return
	}

	// Generate order number
	var orderNumber string
	err = pool.QueryRow(ctx, "SELECT generate_order_number()").Scan(&orderNumber)
	if err != nil {
		log.Printf("Failed to generate order number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate order number")
		return
	}

	// Create order
	orderID := uuid.New()
	_, err = pool.Exec(ctx,
		`INSERT INTO orders (id, user_id, account_id, symbol, order_number, side, type, status, amount_base, limit_price, stop_price, filled_amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, NOW(), NOW())`,
		orderID, userID, req.AccountID, req.Symbol, orderNumber, req.Side, req.Type, models.OrderStatusPending, req.AmountBase, req.LimitPrice, req.StopPrice,
	)
	if err != nil {
		log.Printf("Failed to insert order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create order")
		return
	}

	// For market orders, execute immediately
	if req.Type == models.OrderTypeMarket {
		// Get current market price
		// NOTE: In production, you should fetch this from your price service/cache
		// For now, we require the frontend to pass the current price
		var executionPrice float64
		if req.LimitPrice != nil && *req.LimitPrice > 0 {
			// Frontend can pass current price via limit_price for market orders
			executionPrice = *req.LimitPrice
		} else {
			// Fetch from database (last known price from recent orders or price cache)
			err = pool.QueryRow(ctx,
				`SELECT COALESCE(average_fill_price, 0)
				 FROM orders
				 WHERE symbol = $1 AND status = 'filled' AND average_fill_price IS NOT NULL
				 ORDER BY updated_at DESC LIMIT 1`,
				req.Symbol,
			).Scan(&executionPrice)
			if err != nil || executionPrice == 0 {
				// No recent orders, reject the market order
				log.Printf("Cannot execute market order: no recent price data for %s", req.Symbol)
				// Update order to rejected
				pool.Exec(ctx, "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", models.OrderStatusRejected, orderID)
				respondWithJSONError(w, http.StatusBadRequest, "execution_error", "cannot execute market order: no current price available. please use limit order or pass current price")
				return
			}
		}

		// Execute the order
		executionService := services.NewOrderExecutionService(pool)
		result, err := executionService.ExecuteOrder(ctx, orderID, executionPrice)
		if err != nil {
			log.Printf("Failed to execute order %s: %v", orderNumber, err)
			respondWithJSONError(w, http.StatusInternalServerError, "execution_error", fmt.Sprintf("failed to execute order: %v", err))
			return
		}

		// Log execution result
		executionService.LogOrderExecution(ctx, result)

		if !result.Success {
			// Execution failed (e.g., insufficient balance)
			// Update order to rejected
			pool.Exec(ctx, "UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", models.OrderStatusRejected, orderID)

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"success": false,
				"error":   "execution_failed",
				"message": result.Message,
				"order":   result.Order,
			})
			return
		}

		// Order executed successfully
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		response := map[string]interface{}{
			"success": true,
			"message": result.Message,
			"order":   result.Order,
		}
		if result.Contract != nil {
			response["contract"] = result.Contract
		}
		json.NewEncoder(w).Encode(response)
		return
	}

	// For limit/stop orders, just return the pending order
	// These will be executed by the order matching engine later
	var order models.Order
	err = pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, symbol, order_number, side, type, status, amount_base, limit_price, stop_price, filled_amount, average_fill_price, created_at, updated_at
		 FROM orders WHERE id = $1`,
		orderID,
	).Scan(
		&order.ID, &order.UserID, &order.AccountID, &order.Symbol, &order.OrderNumber, &order.Side, &order.Type, &order.Status,
		&order.AmountBase, &order.LimitPrice, &order.StopPrice, &order.FilledAmount, &order.AverageFillPrice,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		log.Printf("Failed to fetch order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "order created but failed to fetch")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "order created and pending execution",
		"order":   order,
	})
}

// GetOrders handles GET /api/v1/orders
// Returns orders for a specific account
func GetOrders(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	accountIDStr := r.URL.Query().Get("account_id")
	if accountIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "account_id parameter is required")
		return
	}

	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid account_id format")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Verify account belongs to user
	var accountUserID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", accountID).Scan(&accountUserID)
	if err != nil || accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Fetch orders
	rows, err := pool.Query(ctx,
		`SELECT id, user_id, account_id, symbol, order_number, side, type, status, amount_base, limit_price, stop_price, filled_amount, average_fill_price, created_at, updated_at
		 FROM orders
		 WHERE account_id = $1
		 ORDER BY created_at DESC
		 LIMIT 100`,
		accountID,
	)
	if err != nil {
		log.Printf("Failed to query orders: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch orders")
		return
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var order models.Order
		err := rows.Scan(
			&order.ID, &order.UserID, &order.AccountID, &order.Symbol, &order.OrderNumber, &order.Side, &order.Type, &order.Status,
			&order.AmountBase, &order.LimitPrice, &order.StopPrice, &order.FilledAmount, &order.AverageFillPrice,
			&order.CreatedAt, &order.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan order: %v", err)
			continue
		}
		orders = append(orders, order)
	}

	if orders == nil {
		orders = []models.Order{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"orders":  orders,
	})
}

// CancelOrder handles POST /api/v1/orders/{order_id}/cancel
// Cancels a pending order
func CancelOrder(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	orderIDStr := r.URL.Query().Get("order_id")
	if orderIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "order_id parameter is required")
		return
	}

	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid order_id format")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Verify order belongs to user and is pending
	var orderUserID uuid.UUID
	var orderStatus models.OrderStatus
	err = pool.QueryRow(ctx,
		"SELECT user_id, status FROM orders WHERE id = $1",
		orderID,
	).Scan(&orderUserID, &orderStatus)

	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	if orderUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "order does not belong to user")
		return
	}
	if orderStatus != models.OrderStatusPending {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_state", "only pending orders can be cancelled")
		return
	}

	// Update order status to cancelled
	_, err = pool.Exec(ctx,
		"UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2",
		models.OrderStatusCancelled, orderID,
	)
	if err != nil {
		log.Printf("Failed to cancel order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to cancel order")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "order cancelled successfully",
	})
}
