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
	var accountUserID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", req.AccountID).Scan(&accountUserID)
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

	// Create pending order
	orderID := uuid.New()
	_, err = pool.Exec(ctx,
		`INSERT INTO pending_orders (
			id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price, status, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', NOW(), NOW()
		)`,
		orderID, userID, req.AccountID, req.Symbol, req.Type, req.Side, req.Quantity, req.TriggerPrice, req.LimitPrice,
	)
	if err != nil {
		log.Printf("Failed to insert pending order: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create pending order")
		return
	}

	// Fetch created order
	createdOrder, err := getPendingOrderByID(ctx, pool, orderID, userID)
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
	var accountUserID uuid.UUID
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

	// Fetch pending orders
	rows, err := pool.Query(ctx,
		`SELECT id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price,
		        status, executed_at, executed_price, failure_reason, created_at, updated_at
		 FROM pending_orders
		 WHERE account_id = $1
		 ORDER BY created_at DESC`,
		accountID,
	)
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
			&order.Quantity, &order.TriggerPrice, &order.LimitPrice, &order.Status,
			&order.ExecutedAt, &order.ExecutedPrice, &order.FailureReason,
			&order.CreatedAt, &order.UpdatedAt,
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
	var orderUserID uuid.UUID
	var orderStatus models.PendingOrderStatus
	err = pool.QueryRow(ctx, "SELECT user_id, status FROM pending_orders WHERE id = $1", orderID).Scan(&orderUserID, &orderStatus)
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
		respondWithJSONError(w, http.StatusBadRequest, "invalid_status", fmt.Sprintf("cannot cancel order with status: %s", orderStatus))
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
	cancelledOrder, err := getPendingOrderByID(ctx, pool, orderID, userID)
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
func getPendingOrderByID(ctx context.Context, pool DBQuerier, orderID, userID uuid.UUID) (models.PendingOrder, error) {
	var order models.PendingOrder
	err := pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, symbol, type, side, quantity, trigger_price, limit_price,
		        status, executed_at, executed_price, failure_reason, created_at, updated_at
		 FROM pending_orders
		 WHERE id = $1 AND user_id = $2`,
		orderID, userID,
	).Scan(
		&order.ID, &order.UserID, &order.AccountID, &order.Symbol, &order.Type, &order.Side,
		&order.Quantity, &order.TriggerPrice, &order.LimitPrice, &order.Status,
		&order.ExecutedAt, &order.ExecutedPrice, &order.FailureReason,
		&order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		return order, fmt.Errorf("failed to fetch pending order: %w", err)
	}

	return order, nil
}
