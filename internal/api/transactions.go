package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"

	"github.com/google/uuid"
)

// CreateTransaction handles POST /api/v1/transactions
// Creates a new transaction (deposit, withdrawal, transfer)
func CreateTransaction(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	var req struct {
		AccountID       uuid.UUID                 `json:"account_id"`
		Type            models.TransactionType    `json:"type"`
		Currency        string                    `json:"currency"`
		Amount          float64                   `json:"amount"`
		TargetAccountID *uuid.UUID                `json:"target_account_id,omitempty"`
		Description     *string                   `json:"description,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	// Validate amount
	if req.Amount <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "amount must be positive")
		return
	}

	// Validate transfer has target account
	if req.Type == models.TransactionTypeTransfer && req.TargetAccountID == nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "transfer requires target_account_id")
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
	var accountUserID int64
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", req.AccountID).Scan(&accountUserID)
	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
		return
	}
	if accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Generate transaction number
	var transactionNumber string
	err = pool.QueryRow(ctx, "SELECT generate_transaction_number()").Scan(&transactionNumber)
	if err != nil {
		log.Printf("Failed to generate transaction number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate transaction number")
		return
	}

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Create transaction record
	transactionID := uuid.New()
	status := models.TransactionStatusCompleted // For demo, auto-complete

	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (id, account_id, transaction_number, type, currency, amount, status, target_account_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
		transactionID, req.AccountID, transactionNumber, req.Type, req.Currency, req.Amount, status, req.TargetAccountID, req.Description,
	)
	if err != nil {
		log.Printf("Failed to insert transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create transaction")
		return
	}

	// Update balance based on transaction type
	switch req.Type {
	case models.TransactionTypeDeposit:
		// Increase balance
		_, err = tx.Exec(ctx,
			`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
			 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
			 ON CONFLICT (account_id, currency)
			 DO UPDATE SET amount = balances.amount + $3, updated_at = NOW()`,
			req.AccountID, req.Currency, req.Amount,
		)

	case models.TransactionTypeWithdrawal:
		// Decrease balance (check sufficient funds)
		var currentBalance float64
		err = tx.QueryRow(ctx,
			"SELECT amount FROM balances WHERE account_id = $1 AND currency = $2",
			req.AccountID, req.Currency,
		).Scan(&currentBalance)

		if err != nil || currentBalance < req.Amount {
			respondWithJSONError(w, http.StatusBadRequest, "insufficient_funds", "insufficient balance")
			return
		}

		_, err = tx.Exec(ctx,
			`UPDATE balances SET amount = amount - $1, updated_at = NOW()
			 WHERE account_id = $2 AND currency = $3`,
			req.Amount, req.AccountID, req.Currency,
		)

	case models.TransactionTypeTransfer:
		// Decrease from source, increase to target
		var currentBalance float64
		err = tx.QueryRow(ctx,
			"SELECT amount FROM balances WHERE account_id = $1 AND currency = $2",
			req.AccountID, req.Currency,
		).Scan(&currentBalance)

		if err != nil || currentBalance < req.Amount {
			respondWithJSONError(w, http.StatusBadRequest, "insufficient_funds", "insufficient balance")
			return
		}

		// Deduct from source
		_, err = tx.Exec(ctx,
			`UPDATE balances SET amount = amount - $1, updated_at = NOW()
			 WHERE account_id = $2 AND currency = $3`,
			req.Amount, req.AccountID, req.Currency,
		)
		if err == nil {
			// Add to target
			_, err = tx.Exec(ctx,
				`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
				 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
				 ON CONFLICT (account_id, currency)
				 DO UPDATE SET amount = balances.amount + $3, updated_at = NOW()`,
				req.TargetAccountID, req.Currency, req.Amount,
			)
		}
	}

	if err != nil {
		log.Printf("Failed to update balance: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update balance")
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit transaction")
		return
	}

	// Fetch created transaction
	var transaction models.Transaction
	err = pool.QueryRow(ctx,
		`SELECT id, account_id, transaction_number, type, currency, amount, status, target_account_id, description, created_at, updated_at
		 FROM transactions WHERE id = $1`,
		transactionID,
	).Scan(
		&transaction.ID, &transaction.AccountID, &transaction.TransactionNumber, &transaction.Type, &transaction.Currency,
		&transaction.Amount, &transaction.Status, &transaction.TargetAccountID, &transaction.Description,
		&transaction.CreatedAt, &transaction.UpdatedAt,
	)

	if err != nil {
		log.Printf("Failed to fetch transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "transaction created but failed to fetch")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"transaction": transaction,
	})
}

// GetTransactions handles GET /api/v1/transactions
// Returns transactions for a specific account
func GetTransactions(w http.ResponseWriter, r *http.Request) {
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
	var accountUserID int64
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", accountID).Scan(&accountUserID)
	if err != nil || accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Fetch transactions with rejection reasons from deposits table
	rows, err := pool.Query(ctx,
		`SELECT 
			t.id, t.account_id, t.transaction_number, t.type, t.currency, t.amount, t.status, 
			t.target_account_id, t.description, t.metadata, t.created_at, t.updated_at,
			d.admin_notes, d.status as deposit_status
		 FROM transactions t
		 LEFT JOIN deposits d ON t.id = d.transaction_id
		 WHERE t.account_id = $1
		 ORDER BY t.created_at DESC
		 LIMIT 100`,
		accountID,
	)
	if err != nil {
		log.Printf("Failed to query transactions: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch transactions")
		return
	}
	defer rows.Close()

	var transactions []models.Transaction
	for rows.Next() {
		var transaction models.Transaction
		var metadataJSON []byte
		var adminNotes *string
		var depositStatus *string

		err := rows.Scan(
			&transaction.ID, &transaction.AccountID, &transaction.TransactionNumber, &transaction.Type, &transaction.Currency,
			&transaction.Amount, &transaction.Status, &transaction.TargetAccountID, &transaction.Description,
			&metadataJSON, &transaction.CreatedAt, &transaction.UpdatedAt,
			&adminNotes, &depositStatus,
		)
		if err != nil {
			log.Printf("Failed to scan transaction: %v", err)
			continue
		}

		// Parse metadata JSON
		if len(metadataJSON) > 0 {
			if err := json.Unmarshal(metadataJSON, &transaction.Metadata); err != nil {
				log.Printf("Failed to parse transaction metadata: %v", err)
				transaction.Metadata = make(map[string]any)
			}
		} else {
			transaction.Metadata = make(map[string]any)
		}

		// Add rejection reason to metadata if transaction is failed and linked to a rejected deposit
		if transaction.Status == models.TransactionStatusFailed && depositStatus != nil && *depositStatus == "rejected" && adminNotes != nil && *adminNotes != "" {
			transaction.Metadata["rejection_reason"] = *adminNotes
		}

		transactions = append(transactions, transaction)
	}

	if transactions == nil {
		transactions = []models.Transaction{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":      true,
		"transactions": transactions,
	})
}
