package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	// Withdrawal limits
	MinWithdrawalAmount = 10.0
	MaxWithdrawalAmount = 100000.0
)

// CreateWithdrawal handles POST /api/v1/withdrawals
// Creates a new withdrawal request with pending status
func CreateWithdrawal(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("CreateWithdrawal: PANIC recovered: %v", rec)
			respondWithJSONError(w, http.StatusInternalServerError, "internal_error", fmt.Sprintf("internal server error: %v", rec))
		}
	}()

	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to get user ID from context: %v", err)
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Parse request body
	var req models.CreateWithdrawalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("CreateWithdrawal: Failed to decode request body: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body: "+err.Error())
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		log.Printf("CreateWithdrawal: Validation failed: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("CreateWithdrawal: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Verify account belongs to user and check account status
	var accountUserID int64
	var accountStatus string
	var accountType string
	err = tx.QueryRow(ctx,
		`SELECT user_id, status, account_type FROM accounts WHERE id = $1`,
		req.AccountID,
	).Scan(&accountUserID, &accountStatus, &accountType)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
			return
		}
		log.Printf("CreateWithdrawal: Failed to fetch account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify account")
		return
	}

	if accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Check if account is active
	if accountStatus != "active" {
		respondWithJSONError(w, http.StatusBadRequest, "account_inactive", "account must be active to withdraw funds")
		return
	}

	// Check if account is demo (demo accounts cannot withdraw real funds)
	if accountType == "demo" {
		respondWithJSONError(w, http.StatusBadRequest, "demo_account", "demo accounts cannot withdraw real funds")
		return
	}

	// Check if user is active
	var isActive bool
	err = tx.QueryRow(ctx,
		`SELECT is_active FROM users WHERE user_id = $1`,
		userID,
	).Scan(&isActive)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to check user status: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify user status")
		return
	}

	if !isActive {
		respondWithJSONError(w, http.StatusForbidden, "user_inactive", "user account is not active")
		return
	}

	// Check available balance
	var currentBalance float64
	err = tx.QueryRow(ctx,
		"SELECT amount FROM balances WHERE account_id = $1 AND currency = $2",
		req.AccountID, req.Currency,
	).Scan(&currentBalance)

	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusBadRequest, "insufficient_funds", "no balance found for this currency")
			return
		}
		log.Printf("CreateWithdrawal: Failed to fetch balance: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to check balance")
		return
	}

	// Calculate withdrawal fee
	var feeAmount float64
	err = tx.QueryRow(ctx,
		"SELECT calculate_withdrawal_fee($1::withdrawal_method, $2)",
		req.WithdrawalMethod, req.Amount,
	).Scan(&feeAmount)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to calculate fee: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "calculation_error", "failed to calculate withdrawal fee")
		return
	}

	// Calculate net amount (amount user actually receives)
	netAmount := req.Amount - feeAmount

	// Validate net amount is positive
	if netAmount <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_amount", "withdrawal amount must be greater than fee")
		return
	}

	// Check if user has sufficient balance (including fee)
	if currentBalance < req.Amount {
		respondWithJSONError(w, http.StatusBadRequest, "insufficient_funds",
			fmt.Sprintf("insufficient balance. Available: %.2f %s, Required: %.2f %s (includes %.2f %s fee)",
				currentBalance, req.Currency, req.Amount, req.Currency, feeAmount, req.Currency))
		return
	}

	// Marshal withdrawal_details to JSON string for JSONB column
	var withdrawalDetailsValue interface{}
	if req.WithdrawalDetails != nil && len(req.WithdrawalDetails) > 0 {
		// Mask sensitive data before storing
		maskedDetails := make(map[string]interface{})
		for k, v := range req.WithdrawalDetails {
			if k == "account_number" {
				// Store only last 4 digits
				if accountNum, ok := v.(string); ok && len(accountNum) >= 4 {
					maskedDetails["account_last4"] = accountNum[len(accountNum)-4:]
				}
			} else if k == "routing_number" {
				// Store routing number (it's not as sensitive)
				maskedDetails[k] = v
			} else {
				// Store other details as-is (wallet_address, account_holder_name, etc.)
				maskedDetails[k] = v
			}
		}

		withdrawalDetailsJSON, err := json.Marshal(maskedDetails)
		if err != nil {
			log.Printf("CreateWithdrawal: Failed to marshal withdrawal details: %v", err)
			respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid withdrawal details format")
			return
		}
		withdrawalDetailsValue = string(withdrawalDetailsJSON)
	} else {
		withdrawalDetailsValue = nil
	}

	// Generate unique withdrawal reference ID
	var referenceID string
	err = tx.QueryRow(ctx, "SELECT generate_withdrawal_reference_id()").Scan(&referenceID)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to generate reference ID: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate withdrawal reference ID")
		return
	}

	// Get client IP address
	clientIP := getClientIP(r)

	// Create withdrawal record
	withdrawalID := uuid.New()
	status := models.WithdrawalStatusPending

	_, err = tx.Exec(ctx,
		`INSERT INTO withdrawals (id, user_id, account_id, reference_id, withdrawal_method, amount, fee_amount, net_amount, currency, withdrawal_details, status, client_ip, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5::withdrawal_method, $6, $7, $8, $9, $10, $11::withdrawal_status, $12, NOW(), NOW())`,
		withdrawalID, userID, req.AccountID, referenceID, req.WithdrawalMethod, req.Amount, feeAmount, netAmount, req.Currency,
		withdrawalDetailsValue, status, clientIP,
	)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to insert withdrawal: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create withdrawal")
		return
	}

	// Generate transaction number for ledger entry
	var transactionNumber string
	err = tx.QueryRow(ctx, "SELECT generate_transaction_number()").Scan(&transactionNumber)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to generate transaction number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate transaction number")
		return
	}

	// Create pending ledger entry in transactions table
	transactionID := uuid.New()
	description := fmt.Sprintf("Withdrawal request %s - %s %.2f (Pending Approval)", referenceID, req.Currency, req.Amount)

	metadataMap := map[string]interface{}{
		"withdrawal_id": withdrawalID.String(),
		"reference_id":  referenceID,
		"fee_amount":    feeAmount,
		"net_amount":    netAmount,
	}
	metadataBytes, _ := json.Marshal(metadataMap)
	metadataValue := string(metadataBytes)

	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (id, account_id, transaction_number, type, currency, amount, status, description, metadata, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
		transactionID, req.AccountID, transactionNumber, models.TransactionTypeWithdrawal, req.Currency,
		req.Amount, models.TransactionStatusPending, description,
		metadataValue,
	)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to create transaction entry: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create ledger entry")
		return
	}

	// Update withdrawal with transaction_id
	_, err = tx.Exec(ctx,
		`UPDATE withdrawals SET transaction_id = $1 WHERE id = $2`,
		transactionID, withdrawalID,
	)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to link transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to link transaction")
		return
	}

	// Note: Funds are NOT deducted yet - only after admin approval
	// This allows users to see their full balance until withdrawal is actually approved

	// Save withdrawal method for reuse if requested
	if req.SaveForReuse {
		// Check if this method already exists
		var existingID uuid.UUID
		err = tx.QueryRow(ctx,
			`SELECT id FROM saved_withdrawal_methods 
			 WHERE user_id = $1 AND withdrawal_method = $2::withdrawal_method
			 LIMIT 1`,
			userID, req.WithdrawalMethod,
		).Scan(&existingID)

		if err != nil && err.Error() != "no rows in result set" {
			// Ignore if method doesn't exist, but log other errors
			log.Printf("CreateWithdrawal: Error checking saved method: %v", err)
		}

		if existingID == uuid.Nil {
			// Method doesn't exist, create new saved method
			savedMethodID := uuid.New()
			_, err = tx.Exec(ctx,
				`INSERT INTO saved_withdrawal_methods (id, user_id, withdrawal_method, withdrawal_details, last_used_at, created_at, updated_at)
				 VALUES ($1, $2, $3::withdrawal_method, $4, NOW(), NOW(), NOW())`,
				savedMethodID, userID, req.WithdrawalMethod, withdrawalDetailsValue,
			)
			if err != nil {
				log.Printf("CreateWithdrawal: Failed to save withdrawal method (non-critical): %v", err)
				// Don't fail the request if saving fails
			}
		} else {
			// Method exists, update last_used_at
			_, err = tx.Exec(ctx,
				`UPDATE saved_withdrawal_methods 
				 SET last_used_at = NOW(), withdrawal_details = $1, updated_at = NOW()
				 WHERE id = $2`,
				withdrawalDetailsValue, existingID,
			)
			if err != nil {
				log.Printf("CreateWithdrawal: Failed to update saved method (non-critical): %v", err)
			}
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("CreateWithdrawal: Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit transaction")
		return
	}

	// Fetch created withdrawal
	withdrawal, err := getWithdrawalByID(ctx, pool, withdrawalID, userID)
	if err != nil {
		log.Printf("CreateWithdrawal: Failed to fetch created withdrawal: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "withdrawal created but failed to fetch details")
		return
	}

	// Create notification for the user (async, non-blocking)
	go func() {
		notificationCtx, notificationCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer notificationCancel()

		notificationTitle := "Withdrawal Request Created"
		notificationMessage := fmt.Sprintf("Your withdrawal request %s for %.2f %s has been created and is pending admin approval. Net amount: %.2f %s (Fee: %.2f %s)",
			withdrawal.ReferenceID, withdrawal.Amount, withdrawal.Currency, withdrawal.NetAmount, withdrawal.Currency, withdrawal.FeeAmount, withdrawal.Currency)

		metadata := map[string]interface{}{
			"withdrawal_id":    withdrawalID.String(),
			"reference_id":     withdrawal.ReferenceID,
			"amount":           withdrawal.Amount,
			"fee_amount":       withdrawal.FeeAmount,
			"net_amount":       withdrawal.NetAmount,
			"currency":         withdrawal.Currency,
			"withdrawal_method": withdrawal.WithdrawalMethod,
			"status":           "pending",
		}

		if err := CreateNotification(notificationCtx, pool, userID, models.NotificationTypeWithdrawal, notificationTitle, notificationMessage, metadata); err != nil {
			log.Printf("CreateWithdrawal: Failed to create notification: %v", err)
		}
	}()

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"withdrawal": withdrawal,
		"message":    "Withdrawal request created successfully. Pending admin approval. Funds will be deducted upon approval.",
	})
}

// GetWithdrawals handles GET /api/v1/withdrawals?account_id={uuid}
// Returns all withdrawals for a specific account
func GetWithdrawals(w http.ResponseWriter, r *http.Request) {
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

	// Fetch withdrawals
	rows, err := pool.Query(ctx,
		`SELECT id, user_id, account_id, reference_id, withdrawal_method, amount, fee_amount, net_amount, currency,
		        withdrawal_details, status, transaction_id, admin_notes,
		        client_ip, admin_ip, approved_at, rejected_at, completed_at, approved_by, rejected_by,
		        created_at, updated_at
		 FROM withdrawals
		 WHERE account_id = $1
		 ORDER BY created_at DESC
		 LIMIT 100`,
		accountID,
	)
	if err != nil {
		log.Printf("Failed to query withdrawals: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch withdrawals")
		return
	}
	defer rows.Close()

	var withdrawals []models.Withdrawal
	for rows.Next() {
		var withdrawal models.Withdrawal
		var withdrawalDetailsJSON []byte
		var adminNotes *string
		var clientIP *string
		var adminIP *string
		var approvedAt *time.Time
		var rejectedAt *time.Time
		var completedAt *time.Time
		var approvedBy *int64
		var rejectedBy *int64

		err := rows.Scan(
			&withdrawal.ID, &withdrawal.UserID, &withdrawal.AccountID, &withdrawal.ReferenceID,
			&withdrawal.WithdrawalMethod, &withdrawal.Amount, &withdrawal.FeeAmount, &withdrawal.NetAmount, &withdrawal.Currency,
			&withdrawalDetailsJSON, &withdrawal.Status,
			&withdrawal.TransactionID, &adminNotes,
			&clientIP, &adminIP, &approvedAt, &rejectedAt, &completedAt, &approvedBy, &rejectedBy,
			&withdrawal.CreatedAt, &withdrawal.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan withdrawal: %v", err)
			continue
		}

		withdrawal.AdminNotes = adminNotes
		withdrawal.ClientIP = clientIP
		withdrawal.AdminIP = adminIP
		withdrawal.ApprovedAt = approvedAt
		withdrawal.RejectedAt = rejectedAt
		withdrawal.CompletedAt = completedAt
		withdrawal.ApprovedBy = approvedBy
		withdrawal.RejectedBy = rejectedBy

		// Parse withdrawal_details JSON
		if len(withdrawalDetailsJSON) > 0 {
			if err := json.Unmarshal(withdrawalDetailsJSON, &withdrawal.WithdrawalDetails); err != nil {
				log.Printf("Failed to parse withdrawal_details: %v", err)
			}
		}

		withdrawals = append(withdrawals, withdrawal)
	}

	if withdrawals == nil {
		withdrawals = []models.Withdrawal{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":     true,
		"withdrawals": withdrawals,
	})
}

// UpdateWithdrawalStatus handles PUT /api/v1/withdrawals/:id/status (Admin only)
// Updates withdrawal status (approve/reject/complete)
func UpdateWithdrawalStatus(w http.ResponseWriter, r *http.Request) {
	// This should be an admin-only endpoint
	// For now, we'll check if user is authenticated
	// TODO: Add admin role check
	adminID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "admin not authenticated")
		return
	}

	// Extract withdrawal ID from URL path
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 5 || pathParts[0] != "api" || pathParts[1] != "v1" || pathParts[2] != "withdrawals" || pathParts[4] != "status" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid URL path format")
		return
	}

	withdrawalIDStr := pathParts[3]
	withdrawalID, err := uuid.Parse(withdrawalIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid withdrawal ID format")
		return
	}

	// Parse request body
	var req models.UpdateWithdrawalStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Fetch withdrawal details
	var withdrawal models.Withdrawal
	var withdrawalDetailsJSON []byte
	var currentStatus string
	var transactionID uuid.UUID
	var withdrawalMethod string

	err = tx.QueryRow(ctx,
		`SELECT id, user_id, account_id, reference_id, withdrawal_method, amount, fee_amount, net_amount, currency, status, transaction_id, withdrawal_details
		 FROM withdrawals WHERE id = $1`,
		withdrawalID,
	).Scan(
		&withdrawal.ID, &withdrawal.UserID, &withdrawal.AccountID, &withdrawal.ReferenceID,
		&withdrawalMethod, &withdrawal.Amount, &withdrawal.FeeAmount, &withdrawal.NetAmount, &withdrawal.Currency,
		&currentStatus, &transactionID, &withdrawalDetailsJSON,
	)
	
	withdrawal.WithdrawalMethod = models.WithdrawalMethod(withdrawalMethod)

	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "withdrawal not found")
			return
		}
		log.Printf("Failed to fetch withdrawal: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch withdrawal")
		return
	}

	// Check if withdrawal is still pending
	if currentStatus != string(models.WithdrawalStatusPending) {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_status",
			fmt.Sprintf("can only update pending withdrawals (current status: %s)", currentStatus))
		return
	}

	adminIP := getClientIP(r)

	// Handle different status updates
	switch req.Status {
	case models.WithdrawalStatusApproved:
		// First, deduct funds from balance (this is when funds actually leave the account)
		_, err = tx.Exec(ctx,
			`UPDATE balances SET amount = amount - $1, updated_at = NOW()
			 WHERE account_id = $2 AND currency = $3`,
			withdrawal.Amount, withdrawal.AccountID, withdrawal.Currency,
		)
		if err != nil {
			log.Printf("Failed to deduct withdrawal amount: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to deduct funds from account")
			return
		}

		// Update withdrawal status to approved
		_, err = tx.Exec(ctx,
			`UPDATE withdrawals 
			 SET status = $1::withdrawal_status, admin_notes = $2, approved_at = NOW(), approved_by = $3, admin_ip = $4, updated_at = NOW()
			 WHERE id = $5`,
			req.Status, req.AdminNotes, adminID, adminIP, withdrawalID,
		)
		if err != nil {
			log.Printf("Failed to update withdrawal status: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update withdrawal status")
			return
		}

		// Update transaction status to completed
		description := fmt.Sprintf("Withdrawal %s approved - %s %.2f (Fee: %.2f, Net: %.2f)",
			withdrawal.ReferenceID, withdrawal.Currency, withdrawal.Amount, withdrawal.FeeAmount, withdrawal.NetAmount)
		_, err = tx.Exec(ctx,
			`UPDATE transactions 
			 SET status = $1, description = $2, updated_at = NOW()
			 WHERE id = $3`,
			models.TransactionStatusCompleted, description, transactionID,
		)

	case models.WithdrawalStatusRejected:
		// Update withdrawal status to rejected
		// No need to refund since funds were never deducted
		_, err = tx.Exec(ctx,
			`UPDATE withdrawals 
			 SET status = $1::withdrawal_status, admin_notes = $2, rejected_at = NOW(), rejected_by = $3, admin_ip = $4, updated_at = NOW()
			 WHERE id = $5`,
			req.Status, req.AdminNotes, adminID, adminIP, withdrawalID,
		)
		if err != nil {
			log.Printf("Failed to update withdrawal status: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update withdrawal status")
			return
		}

		// Update transaction status to failed
		description := fmt.Sprintf("Withdrawal %s rejected - %s %.2f",
			withdrawal.ReferenceID, withdrawal.Currency, withdrawal.Amount)
		_, err = tx.Exec(ctx,
			`UPDATE transactions 
			 SET status = $1, description = $2, updated_at = NOW()
			 WHERE id = $3`,
			models.TransactionStatusFailed, description, transactionID,
		)

	case models.WithdrawalStatusCompleted:
		// Mark as completed (admin confirms funds were sent)
		_, err = tx.Exec(ctx,
			`UPDATE withdrawals 
			 SET status = $1::withdrawal_status, admin_notes = $2, completed_at = NOW(), admin_ip = $3, updated_at = NOW()
			 WHERE id = $4`,
			req.Status, req.AdminNotes, adminIP, withdrawalID,
		)
		if err != nil {
			log.Printf("Failed to update withdrawal status: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update withdrawal status")
			return
		}

		// Update transaction description
		description := fmt.Sprintf("Withdrawal %s completed - %s %.2f sent to user",
			withdrawal.ReferenceID, withdrawal.Currency, withdrawal.NetAmount)
		_, err = tx.Exec(ctx,
			`UPDATE transactions 
			 SET description = $1, updated_at = NOW()
			 WHERE id = $2`,
			description, transactionID,
		)
	}

	if err != nil {
		log.Printf("Failed to update transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update transaction")
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit transaction")
		return
	}

	// Create notification for the user (async, non-blocking)
	go func() {
		notificationCtx, notificationCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer notificationCancel()

		var notificationTitle, notificationMessage string
		metadata := map[string]interface{}{
			"withdrawal_id":    withdrawalID.String(),
			"reference_id":     withdrawal.ReferenceID,
			"amount":           withdrawal.Amount,
			"fee_amount":       withdrawal.FeeAmount,
			"net_amount":       withdrawal.NetAmount,
			"currency":         withdrawal.Currency,
			"withdrawal_method": withdrawalMethod,
			"status":           string(req.Status),
		}

		switch req.Status {
		case models.WithdrawalStatusApproved:
			notificationTitle = "Withdrawal Success"
			notificationMessage = fmt.Sprintf("Your withdrawal request %s for %.2f %s has been successfully processed. Net amount: %.2f %s (Fee: %.2f %s)",
				withdrawal.ReferenceID, withdrawal.Amount, withdrawal.Currency, withdrawal.NetAmount, withdrawal.Currency, withdrawal.FeeAmount, withdrawal.Currency)
		case models.WithdrawalStatusRejected:
			notificationTitle = "Withdrawal Rejected"
			rejectionReason := "See admin notes for details"
			if req.AdminNotes != nil && *req.AdminNotes != "" {
				rejectionReason = *req.AdminNotes
			}
			notificationMessage = fmt.Sprintf("Your withdrawal request %s for %.2f %s has been rejected. Reason: %s",
				withdrawal.ReferenceID, withdrawal.Amount, withdrawal.Currency, rejectionReason)
			metadata["rejection_reason"] = rejectionReason
		case models.WithdrawalStatusCompleted:
			notificationTitle = "Withdrawal Success"
			notificationMessage = fmt.Sprintf("Your withdrawal %s for %.2f %s (net: %.2f %s) has been successfully completed and funds have been sent.",
				withdrawal.ReferenceID, withdrawal.Amount, withdrawal.Currency, withdrawal.NetAmount, withdrawal.Currency)
		}

		// Validate user_id before creating notification
		if withdrawal.UserID <= 0 {
			log.Printf("UpdateWithdrawalStatus: Invalid user_id=%d, cannot create notification for withdrawal_id=%s", 
				withdrawal.UserID, withdrawalID.String())
			return
		}

		// Log notification creation attempt for debugging
		log.Printf("UpdateWithdrawalStatus: Creating notification for user_id=%d, type=%s, title=%s, status=%s", 
			withdrawal.UserID, models.NotificationTypeWithdrawal, notificationTitle, req.Status)

		if err := CreateNotification(notificationCtx, pool, withdrawal.UserID, models.NotificationTypeWithdrawal, notificationTitle, notificationMessage, metadata); err != nil {
			log.Printf("UpdateWithdrawalStatus: Failed to create notification: %v (user_id=%d, withdrawal_id=%s, status=%s)", 
				err, withdrawal.UserID, withdrawalID.String(), req.Status)
		} else {
			log.Printf("UpdateWithdrawalStatus: Successfully created notification for user_id=%d, withdrawal_id=%s, status=%s", 
				withdrawal.UserID, withdrawalID.String(), req.Status)
		}
	}()

	// Fetch updated withdrawal
	updatedWithdrawal, err := getWithdrawalByIDAdmin(ctx, pool, withdrawalID)
	if err != nil {
		log.Printf("Failed to fetch updated withdrawal: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "withdrawal updated but failed to fetch details")
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":    true,
		"withdrawal": updatedWithdrawal,
		"message":    fmt.Sprintf("Withdrawal %s successfully", req.Status),
	})
}

// Helper function to get withdrawal by ID (for user)
func getWithdrawalByID(ctx context.Context, pool DBQuerier, withdrawalID uuid.UUID, userID int64) (models.Withdrawal, error) {
	var withdrawal models.Withdrawal
	var withdrawalDetailsJSON []byte
	var adminNotes *string
	var clientIP *string
	var adminIP *string
	var approvedAt *time.Time
	var rejectedAt *time.Time
	var completedAt *time.Time
	var approvedBy *int64
	var rejectedBy *int64

	err := pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, reference_id, withdrawal_method, amount, fee_amount, net_amount, currency,
		        withdrawal_details, status, transaction_id, admin_notes,
		        client_ip, admin_ip, approved_at, rejected_at, completed_at, approved_by, rejected_by,
		        created_at, updated_at
		 FROM withdrawals
		 WHERE id = $1 AND user_id = $2`,
		withdrawalID, userID,
	).Scan(
		&withdrawal.ID, &withdrawal.UserID, &withdrawal.AccountID, &withdrawal.ReferenceID,
		&withdrawal.WithdrawalMethod, &withdrawal.Amount, &withdrawal.FeeAmount, &withdrawal.NetAmount, &withdrawal.Currency,
		&withdrawalDetailsJSON, &withdrawal.Status,
		&withdrawal.TransactionID, &adminNotes,
		&clientIP, &adminIP, &approvedAt, &rejectedAt, &completedAt, &approvedBy, &rejectedBy,
		&withdrawal.CreatedAt, &withdrawal.UpdatedAt,
	)
	if err != nil {
		return withdrawal, fmt.Errorf("failed to fetch withdrawal: %w", err)
	}

	withdrawal.AdminNotes = adminNotes
	withdrawal.ClientIP = clientIP
	withdrawal.AdminIP = adminIP
	withdrawal.ApprovedAt = approvedAt
	withdrawal.RejectedAt = rejectedAt
	withdrawal.CompletedAt = completedAt
	withdrawal.ApprovedBy = approvedBy
	withdrawal.RejectedBy = rejectedBy

	// Parse withdrawal_details JSON
	if len(withdrawalDetailsJSON) > 0 {
		if err := json.Unmarshal(withdrawalDetailsJSON, &withdrawal.WithdrawalDetails); err != nil {
			log.Printf("Failed to parse withdrawal_details: %v", err)
		}
	}

	return withdrawal, nil
}

// GetSavedWithdrawalMethods handles GET /api/v1/withdrawals/saved-methods
// Returns all saved withdrawal methods for the authenticated user
func GetSavedWithdrawalMethods(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
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

	// Fetch saved methods
	rows, err := pool.Query(ctx,
		`SELECT id, user_id, withdrawal_method, nickname, withdrawal_details, is_default, last_used_at, created_at, updated_at
		 FROM saved_withdrawal_methods
		 WHERE user_id = $1
		 ORDER BY is_default DESC, last_used_at DESC NULLS LAST, created_at DESC`,
		userID,
	)
	if err != nil {
		log.Printf("Failed to query saved methods: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch saved methods")
		return
	}
	defer rows.Close()

	var savedMethods []models.SavedWithdrawalMethod
	for rows.Next() {
		var method models.SavedWithdrawalMethod
		var detailsJSON []byte
		var nickname *string
		var lastUsedAt *time.Time

		err := rows.Scan(
			&method.ID, &method.UserID, &method.WithdrawalMethod, &nickname, &detailsJSON,
			&method.IsDefault, &lastUsedAt, &method.CreatedAt, &method.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan saved method: %v", err)
			continue
		}

		method.Nickname = nickname
		method.LastUsedAt = lastUsedAt

		// Parse withdrawal_details JSON
		if len(detailsJSON) > 0 {
			if err := json.Unmarshal(detailsJSON, &method.WithdrawalDetails); err != nil {
				log.Printf("Failed to parse withdrawal_details: %v", err)
			}
		}

		savedMethods = append(savedMethods, method)
	}

	if savedMethods == nil {
		savedMethods = []models.SavedWithdrawalMethod{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"methods": savedMethods,
	})
}

// DeleteSavedWithdrawalMethod handles DELETE /api/v1/withdrawals/saved-methods/:id
// Deletes a saved withdrawal method
func DeleteSavedWithdrawalMethod(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Extract method ID from URL path
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 5 {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid URL path format")
		return
	}

	methodIDStr := pathParts[4]
	methodID, err := uuid.Parse(methodIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid method ID format")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Delete the method (only if it belongs to the user)
	result, err := pool.Exec(ctx,
		`DELETE FROM saved_withdrawal_methods WHERE id = $1 AND user_id = $2`,
		methodID, userID,
	)
	if err != nil {
		log.Printf("Failed to delete saved method: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to delete saved method")
		return
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "saved method not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Saved withdrawal method deleted successfully",
	})
}

// Helper function to get withdrawal by ID (for admin)
func getWithdrawalByIDAdmin(ctx context.Context, pool DBQuerier, withdrawalID uuid.UUID) (models.Withdrawal, error) {
	var withdrawal models.Withdrawal
	var withdrawalDetailsJSON []byte
	var adminNotes *string
	var clientIP *string
	var adminIP *string
	var approvedAt *time.Time
	var rejectedAt *time.Time
	var completedAt *time.Time
	var approvedBy *int64
	var rejectedBy *int64

	err := pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, reference_id, withdrawal_method, amount, fee_amount, net_amount, currency,
		        withdrawal_details, status, transaction_id, admin_notes,
		        client_ip, admin_ip, approved_at, rejected_at, completed_at, approved_by, rejected_by,
		        created_at, updated_at
		 FROM withdrawals
		 WHERE id = $1`,
		withdrawalID,
	).Scan(
		&withdrawal.ID, &withdrawal.UserID, &withdrawal.AccountID, &withdrawal.ReferenceID,
		&withdrawal.WithdrawalMethod, &withdrawal.Amount, &withdrawal.FeeAmount, &withdrawal.NetAmount, &withdrawal.Currency,
		&withdrawalDetailsJSON, &withdrawal.Status,
		&withdrawal.TransactionID, &adminNotes,
		&clientIP, &adminIP, &approvedAt, &rejectedAt, &completedAt, &approvedBy, &rejectedBy,
		&withdrawal.CreatedAt, &withdrawal.UpdatedAt,
	)
	if err != nil {
		return withdrawal, fmt.Errorf("failed to fetch withdrawal: %w", err)
	}

	withdrawal.AdminNotes = adminNotes
	withdrawal.ClientIP = clientIP
	withdrawal.AdminIP = adminIP
	withdrawal.ApprovedAt = approvedAt
	withdrawal.RejectedAt = rejectedAt
	withdrawal.CompletedAt = completedAt
	withdrawal.ApprovedBy = approvedBy
	withdrawal.RejectedBy = rejectedBy

	// Parse withdrawal_details JSON
	if len(withdrawalDetailsJSON) > 0 {
		if err := json.Unmarshal(withdrawalDetailsJSON, &withdrawal.WithdrawalDetails); err != nil {
			log.Printf("Failed to parse withdrawal_details: %v", err)
		}
	}

	return withdrawal, nil
}

