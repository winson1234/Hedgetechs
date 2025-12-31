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
	"brokerageProject/internal/utils"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// TransferRequest represents the request body for transferring funds between accounts
type TransferRequest struct {
	FromAccountID uuid.UUID `json:"from_account_id"`
	ToAccountID   uuid.UUID `json:"to_account_id"`
	Amount        float64   `json:"amount"`
	Currency      string    `json:"currency"`
}

// Transfer handles POST /api/v1/transfers
// Creates a transfer between two internal accounts with full validation, atomic operations,
// dual ledger entries, audit logging, and email notifications
func Transfer(w http.ResponseWriter, r *http.Request) {
	// Recover from any panics
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("Transfer: PANIC recovered: %v", rec)
			respondWithJSONError(w, http.StatusInternalServerError, "internal_error", fmt.Sprintf("internal server error: %v", rec))
		}
	}()

	// Extract user ID from context (injected by AuthMiddleware)
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		log.Printf("Transfer: Failed to get user ID from context: %v", err)
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Get IP address and user agent from context
	clientIP := utils.GetClientIP(r)
	userAgent := r.UserAgent()

	// Parse request body
	var req TransferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Transfer: Failed to decode request body: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body: "+err.Error())
		return
	}

	// Validate request
	if req.FromAccountID == uuid.Nil || req.ToAccountID == uuid.Nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "from_account_id and to_account_id are required")
		return
	}

	if req.FromAccountID == req.ToAccountID {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "cannot transfer to the same account")
		return
	}

	if req.Amount <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "amount must be positive")
		return
	}

	if req.Currency == "" {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "currency is required")
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Transfer: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Start transaction for atomic operations
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Transfer: Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Validate both accounts exist and belong to the same user
	var fromAccountUserID, toAccountUserID int64
	var fromAccountType, toAccountType string
	var fromAccountCurrency, toAccountCurrency string
	var fromAccountStatus, toAccountStatus string
	var fromAccountID, toAccountID int64

	err = tx.QueryRow(ctx,
		`SELECT user_id, account_type, currency, status, account_id 
		 FROM accounts WHERE id = $1`,
		req.FromAccountID,
	).Scan(&fromAccountUserID, &fromAccountType, &fromAccountCurrency, &fromAccountStatus, &fromAccountID)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "source account not found")
			return
		}
		log.Printf("Transfer: Failed to fetch source account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch source account")
		return
	}

	err = tx.QueryRow(ctx,
		`SELECT user_id, account_type, currency, status, account_id 
		 FROM accounts WHERE id = $1`,
		req.ToAccountID,
	).Scan(&toAccountUserID, &toAccountType, &toAccountCurrency, &toAccountStatus, &toAccountID)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "destination account not found")
			return
		}
		log.Printf("Transfer: Failed to fetch destination account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch destination account")
		return
	}

	// Verify both accounts belong to the same user
	if fromAccountUserID != userID {
		log.Printf("Transfer: Source account does not belong to user - Account UserID: %v, Request UserID: %v", fromAccountUserID, userID)
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "source account does not belong to user")
		return
	}

	if toAccountUserID != userID {
		log.Printf("Transfer: Destination account does not belong to user - Account UserID: %v, Request UserID: %v", toAccountUserID, userID)
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "destination account does not belong to user")
		return
	}

	// Verify accounts are available for transfer (not suspended)
	if fromAccountStatus == "suspended" {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "source account is suspended and cannot transfer funds")
		return
	}

	if toAccountStatus == "suspended" {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "destination account is suspended and cannot receive funds")
		return
	}

	// Verify currency match
	if fromAccountCurrency != req.Currency {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", fmt.Sprintf("source account currency (%s) does not match transfer currency (%s)", fromAccountCurrency, req.Currency))
		return
	}

	if toAccountCurrency != req.Currency {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", fmt.Sprintf("destination account currency (%s) does not match transfer currency (%s)", toAccountCurrency, req.Currency))
		return
	}

	// Check sufficient balance in source account
	var currentBalance float64
	err = tx.QueryRow(ctx,
		`SELECT amount FROM balances WHERE account_id = $1 AND currency = $2`,
		req.FromAccountID, req.Currency,
	).Scan(&currentBalance)
	if err != nil {
		if err == pgx.ErrNoRows {
			currentBalance = 0
		} else {
			log.Printf("Transfer: Failed to check source balance: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to check source balance")
			return
		}
	}

	if currentBalance < req.Amount {
		respondWithJSONError(w, http.StatusBadRequest, "insufficient_funds",
			fmt.Sprintf("insufficient balance. Available: %.2f %s, Required: %.2f %s", currentBalance, req.Currency, req.Amount, req.Currency))
		return
	}

	// Generate transaction numbers for both entries
	var debitTransactionNumber, creditTransactionNumber string
	err = tx.QueryRow(ctx, "SELECT generate_transaction_number()").Scan(&debitTransactionNumber)
	if err != nil {
		log.Printf("Transfer: Failed to generate debit transaction number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate transaction number")
		return
	}

	err = tx.QueryRow(ctx, "SELECT generate_transaction_number()").Scan(&creditTransactionNumber)
	if err != nil {
		log.Printf("Transfer: Failed to generate credit transaction number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate transaction number")
		return
	}

	// Create DEBIT transaction (source account)
	debitTransactionID := uuid.New()
	debitDescription := fmt.Sprintf("Transfer to Account %d (%s)", toAccountID, toAccountType)
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (id, account_id, transaction_number, type, currency, amount, status, target_account_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
		debitTransactionID, req.FromAccountID, debitTransactionNumber, models.TransactionTypeTransfer, req.Currency, req.Amount,
		models.TransactionStatusCompleted, &req.ToAccountID, &debitDescription,
	)
	if err != nil {
		log.Printf("Transfer: Failed to create debit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create debit transaction")
		return
	}

	// Create CREDIT transaction (destination account)
	creditTransactionID := uuid.New()
	creditDescription := fmt.Sprintf("Transfer from Account %d (%s)", fromAccountID, fromAccountType)
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (id, account_id, transaction_number, type, currency, amount, status, target_account_id, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
		creditTransactionID, req.ToAccountID, creditTransactionNumber, models.TransactionTypeTransfer, req.Currency, req.Amount,
		models.TransactionStatusCompleted, &req.FromAccountID, &creditDescription,
	)
	if err != nil {
		log.Printf("Transfer: Failed to create credit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create credit transaction")
		return
	}

	// Perform atomic balance updates
	// 1. Debit from source account
	_, err = tx.Exec(ctx,
		`UPDATE balances SET amount = amount - $1, updated_at = NOW()
		 WHERE account_id = $2 AND currency = $3`,
		req.Amount, req.FromAccountID, req.Currency,
	)
	if err != nil {
		log.Printf("Transfer: Failed to debit source balance: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update source balance")
		return
	}

	// 2. Credit to destination account (UPSERT)
	_, err = tx.Exec(ctx,
		`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
		 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
		 ON CONFLICT (account_id, currency)
		 DO UPDATE SET amount = balances.amount + $3, updated_at = NOW()`,
		req.ToAccountID, req.Currency, req.Amount,
	)
	if err != nil {
		log.Printf("Transfer: Failed to credit destination balance: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update destination balance")
		return
	}

	// Note: accounts.balance is automatically synced by trigger_sync_account_balance
	// when balances table is updated, so we don't need to manually update it here

	// Get user UUID for audit logging
	var userUUID uuid.UUID
	err = tx.QueryRow(ctx, "SELECT keycloak_id FROM users WHERE user_id = $1", userID).Scan(&userUUID)
	if err != nil {
		log.Printf("Transfer: Failed to get user UUID: %v", err)
		// Continue without audit log if we can't get UUID
	} else {
		// Log audit event for transfer
		auditLogger := utils.NewAuditLogger(pool)
		auditEntry := models.NewAuditLogEntry(userUUID, models.ActionTransferCompleted, models.ResourceTypeTransaction).
			WithResourceID(debitTransactionID).
			WithIPAddress(clientIP).
			WithUserAgent(userAgent).
			WithMetadata("from_account_id", req.FromAccountID.String()).
			WithMetadata("from_account_number", fromAccountID).
			WithMetadata("from_account_type", fromAccountType).
			WithMetadata("to_account_id", req.ToAccountID.String()).
			WithMetadata("to_account_number", toAccountID).
			WithMetadata("to_account_type", toAccountType).
			WithMetadata("amount", req.Amount).
			WithMetadata("currency", req.Currency).
			WithMetadata("debit_transaction_id", debitTransactionID.String()).
			WithMetadata("credit_transaction_id", creditTransactionID.String()).
			WithMetadata("debit_transaction_number", debitTransactionNumber).
			WithMetadata("credit_transaction_number", creditTransactionNumber)

		if err := auditLogger.LogFromRequest(ctx, r, auditEntry); err != nil {
			log.Printf("Transfer: Failed to log audit event: %v", err)
			// Continue - audit logging failure should not fail the transfer
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("Transfer: Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit transaction")
		return
	}

	// Create notification for the user (async, non-blocking)
	go func() {
		notificationCtx, notificationCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer notificationCancel()

		notificationTitle := "Transfer Completed"
		notificationMessage := fmt.Sprintf("Successfully transferred %.2f %s from Account %d (%s) to Account %d (%s)",
			req.Amount, req.Currency, fromAccountID, fromAccountType, toAccountID, toAccountType)

		metadata := map[string]interface{}{
			"from_account_id":     req.FromAccountID.String(),
			"from_account_number": fmt.Sprintf("%d", fromAccountID),
			"from_account_type":   fromAccountType,
			"to_account_id":       req.ToAccountID.String(),
			"to_account_number":   fmt.Sprintf("%d", toAccountID),
			"to_account_type":     toAccountType,
			"amount":              req.Amount,
			"currency":            req.Currency,
			"transaction_number":  debitTransactionNumber,
		}

		if err := CreateNotification(notificationCtx, pool, userID, models.NotificationTypeTransfer, notificationTitle, notificationMessage, metadata); err != nil {
			log.Printf("Transfer: Failed to create notification: %v", err)
		}
	}()

	// Fetch created transactions for response
	var debitTransaction, creditTransaction models.Transaction
	err = pool.QueryRow(ctx,
		`SELECT id, account_id, transaction_number, type, currency, amount, status, target_account_id, description, created_at, updated_at
		 FROM transactions WHERE id = $1`,
		debitTransactionID,
	).Scan(
		&debitTransaction.ID, &debitTransaction.AccountID, &debitTransaction.TransactionNumber,
		&debitTransaction.Type, &debitTransaction.Currency, &debitTransaction.Amount,
		&debitTransaction.Status, &debitTransaction.TargetAccountID, &debitTransaction.Description,
		&debitTransaction.CreatedAt, &debitTransaction.UpdatedAt,
	)
	if err != nil {
		log.Printf("Transfer: Failed to fetch debit transaction: %v", err)
	}

	err = pool.QueryRow(ctx,
		`SELECT id, account_id, transaction_number, type, currency, amount, status, target_account_id, description, created_at, updated_at
		 FROM transactions WHERE id = $1`,
		creditTransactionID,
	).Scan(
		&creditTransaction.ID, &creditTransaction.AccountID, &creditTransaction.TransactionNumber,
		&creditTransaction.Type, &creditTransaction.Currency, &creditTransaction.Amount,
		&creditTransaction.Status, &creditTransaction.TargetAccountID, &creditTransaction.Description,
		&creditTransaction.CreatedAt, &creditTransaction.UpdatedAt,
	)
	if err != nil {
		log.Printf("Transfer: Failed to fetch credit transaction: %v", err)
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Transfer completed successfully",
		"transfer": map[string]interface{}{
			"debit_transaction":  debitTransaction,
			"credit_transaction": creditTransaction,
			"amount":             req.Amount,
			"currency":           req.Currency,
			"from_account_id":    req.FromAccountID,
			"to_account_id":      req.ToAccountID,
		},
	})
}
