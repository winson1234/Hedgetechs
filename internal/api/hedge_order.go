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

// CreateHedgeOrder handles POST /api/v1/orders/hedge
// Atomically creates a dual-position hedged order (Long + Short)
func CreateHedgeOrder(w http.ResponseWriter, r *http.Request) {
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

	// Basic validation
	if req.AccountID == uuid.Nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "account_id is required")
		return
	}
	if req.Symbol == "" {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "symbol is required")
		return
	}
	if req.AmountBase <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "amount must be positive")
		return
	}

	// Normalize symbol
	normalizedSymbol := normalizeSymbol(req.Symbol)

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Verify account belongs to user and get user UUID
	var accountUserID int64
	var userUUID uuid.UUID
	err = pool.QueryRow(ctx, `
		SELECT a.user_id, u.keycloak_id
		FROM accounts a
		JOIN users u ON a.user_id = u.user_id
		WHERE a.id = $1
	`, req.AccountID).Scan(&accountUserID, &userUUID)
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
	err = pool.QueryRow(ctx, "SELECT is_tradable FROM instruments WHERE symbol = $1", normalizedSymbol).Scan(&isTradeable)
	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "instrument not found")
		return
	}
	if !isTradeable {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "instrument is not tradeable")
		return
	}

	// Get current market price
	priceCache := services.GetGlobalPriceCache()
	executionPrice, err := priceCache.GetPrice(normalizedSymbol)
	if err != nil {
		log.Printf("Cannot execute hedge order for %s: %v", normalizedSymbol, err)
		respondWithJSONError(w, http.StatusBadRequest, "execution_error", fmt.Sprintf("cannot execute hedge order: %v", err))
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

	// Set default leverage
	leverage := req.Leverage
	if leverage < 1 {
		leverage = 1
	}

	// Create parent order (marked as FILLED immediately as it's just a container/record for the hedge)
	// We use 'buy' side arbitrarily for the container order, but the result will be two positions
	orderID := uuid.New()

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Create proper Order object for execution service
	order := &models.Order{
		ID:          orderID,
		UserID:      userUUID, // Use UUID (Keycloak ID) for struct field
		AccountID:   req.AccountID,
		Symbol:      normalizedSymbol,
		OrderNumber: orderNumber,
		Side:        models.OrderSideBuy, // Placeholder side
		Type:        models.OrderTypeMarket,
		Status:      models.OrderStatusPending,
		AmountBase:  req.AmountBase,
		Leverage:    leverage,
		ProductType: req.ProductType,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Calculate notional and fee (needed for execution logic)
	// Dual position logic calculates margin based on 2x this
	notionalValue := req.AmountBase * executionPrice
	feeRate := 0.001
	fee := notionalValue * feeRate

	// Use OrderExecutionService logic to create dual positions
	executionService := services.NewOrderExecutionService(pool)

	// We need to fetch account currency for the check
	var accountCurrency string
	err = tx.QueryRow(ctx, "SELECT currency FROM accounts WHERE id = $1", req.AccountID).Scan(&accountCurrency)
	if err != nil {
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch account currency")
		return
	}

	// Insert order first (required by execution service to update it later, though we could bypass)
	// NOTE: Use accountUserID (int64) for SQL INSERT, not order.UserID (UUID)
	_, err = tx.Exec(ctx,
		`INSERT INTO orders (id, user_id, account_id, symbol, order_number, side, type, status, amount_base, limit_price, stop_price, leverage, product_type, pair_id, execution_strategy, filled_amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'hedge', 0, NOW(), NOW())`,
		order.ID, accountUserID, order.AccountID, order.Symbol, order.OrderNumber, order.Side, order.Type, models.OrderStatusPending, order.AmountBase, 0, 0, order.Leverage, order.ProductType, nil,
	)
	if err != nil {
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create parent order")
		return
	}

	// Execute Dual Position (Hedge)
	result, err := executionService.ExecuteDualPositionOrder(ctx, tx, order, executionPrice, notionalValue, fee, accountCurrency)
	if err != nil {
		// Log error and rollback
		log.Printf("Hedge execution failed: %v", err)
		// Mark order rejected if possible, but transaction rollback deletes it anyway.
		// So we just return error.
		respondWithJSONError(w, http.StatusBadRequest, "execution_error", fmt.Sprintf("hedge execution failed: %v", err))
		return
	}

	if !result.Success {
		respondWithJSONError(w, http.StatusBadRequest, "execution_failed", result.Message)
		return
	}

	// Commit complete transaction
	if err := tx.Commit(ctx); err != nil {
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit hedge transaction")
		return
	}

	// Log result
	executionService.LogOrderExecution(ctx, result)

	// Success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  result.Message,
		"order":    result.Order,
		"contract": result.Contract, // Contains primary contract info
	})
}
