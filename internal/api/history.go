package api

import (
	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"
	"brokerageProject/internal/utils"
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// BatchHistoryResponse combines all history data in a single response
type BatchHistoryResponse struct {
	Transactions  []models.Transaction       `json:"transactions"`
	Orders        []models.Order             `json:"orders"`
	PendingOrders []models.PendingOrder      `json:"pending_orders"`
	Success       bool                       `json:"success"`
}

// GetBatchHistory retrieves all history data (transactions, orders, pending orders) for the authenticated user
// This endpoint fixes the N+1 query problem by fetching all data in a single call
// GET /api/v1/history
func GetBatchHistory(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context (set by auth middleware)
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "authentication required")
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Failed to get database pool: %v", err)
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to connect to database")
		return
	}

	ctx := r.Context()

	// Fetch all transactions for user's accounts
	transactions, err := fetchUserTransactions(ctx, pool, userID)
	if err != nil {
		log.Printf("Failed to fetch transactions: %v", err)
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch transactions")
		return
	}

	// Fetch all orders for user's accounts
	orders, err := fetchUserOrders(ctx, pool, userID)
	if err != nil {
		log.Printf("Failed to fetch orders: %v", err)
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch orders")
		return
	}

	// Fetch all pending orders for user's accounts
	pendingOrders, err := fetchUserPendingOrders(ctx, pool, userID)
	if err != nil {
		log.Printf("Failed to fetch pending orders: %v", err)
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch pending orders")
		return
	}

	// Return batch response
	response := BatchHistoryResponse{
		Transactions:  transactions,
		Orders:        orders,
		PendingOrders: pendingOrders,
		Success:       true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// fetchUserTransactions retrieves all transactions for user's accounts in a single query
func fetchUserTransactions(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]models.Transaction, error) {
	query := `
		SELECT t.id, t.account_id, t.transaction_number, t.type, t.currency, t.amount,
		       t.status, t.target_account_id, t.contract_id, t.description, t.metadata,
		       t.created_at, t.updated_at
		FROM transactions t
		INNER JOIN accounts a ON t.account_id = a.id
		WHERE a.user_id = $1
		ORDER BY t.created_at DESC
		LIMIT 100
	`

	rows, err := pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var t models.Transaction
		err := rows.Scan(
			&t.ID, &t.AccountID, &t.TransactionNumber, &t.Type, &t.Currency, &t.Amount,
			&t.Status, &t.TargetAccountID, &t.ContractID, &t.Description, &t.Metadata,
			&t.CreatedAt, &t.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		transactions = append(transactions, t)
	}

	return transactions, rows.Err()
}

// fetchUserOrders retrieves all orders for user's accounts in a single query
func fetchUserOrders(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]models.Order, error) {
	query := `
		SELECT id, user_id, account_id, symbol, order_number, side, type, status,
		       amount_base, limit_price, stop_price, filled_amount, average_fill_price,
		       created_at, updated_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`

	rows, err := pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []models.Order
	for rows.Next() {
		var o models.Order
		err := rows.Scan(
			&o.ID, &o.UserID, &o.AccountID, &o.Symbol, &o.OrderNumber, &o.Side, &o.Type, &o.Status,
			&o.AmountBase, &o.LimitPrice, &o.StopPrice, &o.FilledAmount, &o.AverageFillPrice,
			&o.CreatedAt, &o.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}

	return orders, rows.Err()
}

// fetchUserPendingOrders retrieves all pending orders for user's accounts in a single query
func fetchUserPendingOrders(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]models.PendingOrder, error) {
	query := `
		SELECT id, user_id, account_id, symbol, type, side, quantity,
		       trigger_price, limit_price, status, executed_at, executed_price,
		       failure_reason, created_at, updated_at
		FROM pending_orders
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`

	rows, err := pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pendingOrders []models.PendingOrder
	for rows.Next() {
		var po models.PendingOrder
		err := rows.Scan(
			&po.ID, &po.UserID, &po.AccountID, &po.Symbol, &po.Type, &po.Side, &po.Quantity,
			&po.TriggerPrice, &po.LimitPrice, &po.Status, &po.ExecutedAt, &po.ExecutedPrice,
			&po.FailureReason, &po.CreatedAt, &po.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		pendingOrders = append(pendingOrders, po)
	}

	return pendingOrders, rows.Err()
}
