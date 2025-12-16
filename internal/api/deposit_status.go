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
	"brokerageProject/internal/services"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// UpdateDepositStatus handles PUT/PATCH /api/v1/deposits/:id/status
// Updates deposit status (approve/reject), credits wallet if approved, and sends notifications
func UpdateDepositStatus(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("UpdateDepositStatus: PANIC recovered: %v", rec)
			respondWithJSONError(w, http.StatusInternalServerError, "internal_error", fmt.Sprintf("internal server error: %v", rec))
		}
	}()

	// Get admin user ID from context (for audit trail)
	// This should come from admin authentication middleware
	adminUserID, _ := middleware.GetUserIDFromContext(r.Context())

	// Get admin IP address
	adminIP := getClientIP(r)

	// Extract deposit ID from URL path
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 4 || pathParts[0] != "api" || pathParts[1] != "v1" || pathParts[2] != "deposits" || pathParts[4] != "status" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid URL path format")
		return
	}

	depositIDStr := pathParts[3]
	depositID, err := uuid.Parse(depositIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid deposit ID format")
		return
	}

	// Parse request body
	var req models.UpdateDepositStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("UpdateDepositStatus: Failed to decode request body: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body: "+err.Error())
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		log.Printf("UpdateDepositStatus: Validation failed: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("UpdateDepositStatus: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Start transaction for atomicity
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("UpdateDepositStatus: Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Fetch deposit details
	var deposit struct {
		UserID        int64
		AccountID     uuid.UUID
		ReferenceID   string
		Amount        float64
		Currency      string
		Status        string
		TransactionID *uuid.UUID
		UserEmail     string
	}

	err = tx.QueryRow(ctx,
		`SELECT d.user_id, d.account_id, d.reference_id, d.amount, d.currency, d.status, d.transaction_id, u.email
		 FROM deposits d
		 JOIN users u ON d.user_id = u.user_id
		 WHERE d.id = $1`,
		depositID,
	).Scan(&deposit.UserID, &deposit.AccountID, &deposit.ReferenceID, &deposit.Amount,
		&deposit.Currency, &deposit.Status, &deposit.TransactionID, &deposit.UserEmail)

	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "deposit not found")
			return
		}
		log.Printf("UpdateDepositStatus: Failed to fetch deposit: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch deposit")
		return
	}

	// Check if deposit is still pending
	if deposit.Status != "pending" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_status",
			fmt.Sprintf("can only update pending deposits, current status: %s", deposit.Status))
		return
	}

	// Process based on new status
	var transactionStatus string
	var description string
	adminNotesValue := req.AdminNotes

	if req.Status == models.DepositStatusApproved {
		// APPROVED: Credit wallet balance
		transactionStatus = string(models.TransactionStatusCompleted)
		description = fmt.Sprintf("Deposit %s - %s %.2f (Approved & Credited)", deposit.ReferenceID, deposit.Currency, deposit.Amount)

		// Fetch account details to verify currency
		var accountCurrency string
		err = tx.QueryRow(ctx,
			`SELECT currency FROM accounts WHERE id = $1`,
			deposit.AccountID,
		).Scan(&accountCurrency)

		if err != nil {
			log.Printf("UpdateDepositStatus: Failed to fetch account: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify account")
			return
		}

		// Verify currency match
		if deposit.Currency != accountCurrency {
			respondWithJSONError(w, http.StatusBadRequest, "currency_mismatch",
				fmt.Sprintf("deposit currency (%s) does not match account currency (%s)", deposit.Currency, accountCurrency))
			return
		}

		// Credit account balance
		_, err = tx.Exec(ctx,
			`UPDATE accounts SET balance = balance + $1, last_updated = NOW() WHERE id = $2`,
			deposit.Amount, deposit.AccountID,
		)
		if err != nil {
			log.Printf("UpdateDepositStatus: Failed to credit account balance: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to credit wallet")
			return
		}

		// Update balances table (used by frontend for wallet display)
		_, err = tx.Exec(ctx,
			`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
			 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
			 ON CONFLICT (account_id, currency)
			 DO UPDATE SET amount = balances.amount + $3, updated_at = NOW()`,
			deposit.AccountID, deposit.Currency, deposit.Amount,
		)
		if err != nil {
			log.Printf("UpdateDepositStatus: Failed to update balances table: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update balances")
			return
		}

		log.Printf("UpdateDepositStatus: Credited %.2f %s to account %s (updated both accounts.balance and balances table)", deposit.Amount, deposit.Currency, deposit.AccountID)

	} else {
		// REJECTED: Mark as failed
		transactionStatus = string(models.TransactionStatusFailed)
		description = fmt.Sprintf("Deposit %s - %s %.2f (Rejected)", deposit.ReferenceID, deposit.Currency, deposit.Amount)
	}

	// Update transaction status (if transaction exists)
	if deposit.TransactionID != nil {
		// If rejected, update metadata with rejection reason (merge with existing)
		if req.Status == models.DepositStatusRejected && adminNotesValue != nil && *adminNotesValue != "" {
			// Fetch existing metadata
			var existingMetadataJSON []byte
			err = tx.QueryRow(ctx, "SELECT metadata FROM transactions WHERE id = $1", deposit.TransactionID).Scan(&existingMetadataJSON)
			if err != nil && err != pgx.ErrNoRows {
				log.Printf("UpdateDepositStatus: Failed to fetch existing transaction metadata: %v", err)
			}

			// Parse existing metadata
			metadata := make(map[string]interface{})
			if len(existingMetadataJSON) > 0 {
				if err := json.Unmarshal(existingMetadataJSON, &metadata); err != nil {
					log.Printf("UpdateDepositStatus: Failed to parse existing metadata: %v", err)
					metadata = make(map[string]interface{})
				}
			}

			// Add rejection reason
			metadata["rejection_reason"] = *adminNotesValue

			// Marshal updated metadata
			metadataJSON, err := json.Marshal(metadata)
			if err != nil {
				log.Printf("UpdateDepositStatus: Failed to marshal metadata: %v", err)
				metadataJSON = nil
			}

			if len(metadataJSON) > 0 {
				// Update with merged metadata
				_, err = tx.Exec(ctx,
					`UPDATE transactions SET status = $1, description = $2, metadata = $3, updated_at = NOW() WHERE id = $4`,
					transactionStatus, description, metadataJSON, deposit.TransactionID,
				)
			} else {
				// Fallback: update without metadata
				_, err = tx.Exec(ctx,
					`UPDATE transactions SET status = $1, description = $2, updated_at = NOW() WHERE id = $3`,
					transactionStatus, description, deposit.TransactionID,
				)
			}
		} else {
			// Not rejected: update without changing metadata
			_, err = tx.Exec(ctx,
				`UPDATE transactions SET status = $1, description = $2, updated_at = NOW() WHERE id = $3`,
				transactionStatus, description, deposit.TransactionID,
			)
		}
		if err != nil {
			log.Printf("UpdateDepositStatus: Failed to update transaction: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update ledger")
			return
		}
	}

	// Update deposit status and admin notes with audit trail
	if req.Status == models.DepositStatusApproved {
		_, err = tx.Exec(ctx,
			`UPDATE deposits SET 
				status = $1, 
				admin_notes = $2, 
				admin_ip = $3,
				approved_at = NOW(),
				approved_by = $4,
				updated_at = NOW() 
			WHERE id = $5`,
			req.Status, adminNotesValue, adminIP, adminUserID, depositID,
		)
	} else {
		_, err = tx.Exec(ctx,
			`UPDATE deposits SET 
				status = $1, 
				admin_notes = $2, 
				admin_ip = $3,
				rejected_at = NOW(),
				rejected_by = $4,
				updated_at = NOW() 
			WHERE id = $5`,
			req.Status, adminNotesValue, adminIP, adminUserID, depositID,
		)
	}
	if err != nil {
		log.Printf("UpdateDepositStatus: Failed to update deposit status: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update deposit")
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("UpdateDepositStatus: Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit transaction")
		return
	}

	// Send email notification (after successful commit)
	// Get email sender from context or environment
	emailSender := getEmailSender()
	if emailSender != nil {
		go func() {
			emailCtx, emailCancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer emailCancel()

			if req.Status == models.DepositStatusApproved {
				if err := emailSender.SendDepositApproved(emailCtx, deposit.UserEmail, deposit.ReferenceID, deposit.Currency, deposit.Amount); err != nil {
					log.Printf("UpdateDepositStatus: Failed to send approval email: %v", err)
				}
			} else {
				reason := "See admin notes for details"
				if adminNotesValue != nil && *adminNotesValue != "" {
					reason = *adminNotesValue
				}
				if err := emailSender.SendDepositRejected(emailCtx, deposit.UserEmail, deposit.ReferenceID, deposit.Currency, deposit.Amount, reason); err != nil {
					log.Printf("UpdateDepositStatus: Failed to send rejection email: %v", err)
				}
			}
		}()
	}

	// Create in-app notification for the user (async, non-blocking)
	go func() {
		notificationCtx, notificationCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer notificationCancel()

		var notificationTitle, notificationMessage string
		metadata := map[string]interface{}{
			"deposit_id":   depositID.String(),
			"reference_id": deposit.ReferenceID,
			"amount":       deposit.Amount,
			"currency":     deposit.Currency,
			"account_id":   deposit.AccountID.String(),
		}

		if req.Status == models.DepositStatusApproved {
			notificationTitle = "Deposit Approved"
			notificationMessage = fmt.Sprintf("Your deposit request %s for %.2f %s has been approved and credited to your account.",
				deposit.ReferenceID, deposit.Amount, deposit.Currency)
		} else {
			notificationTitle = "Deposit Rejected"
			rejectionReason := "See admin notes for details"
			if adminNotesValue != nil && *adminNotesValue != "" {
				rejectionReason = *adminNotesValue
			}
			notificationMessage = fmt.Sprintf("Your deposit request %s for %.2f %s has been rejected. Reason: %s",
				deposit.ReferenceID, deposit.Amount, deposit.Currency, rejectionReason)
			metadata["rejection_reason"] = rejectionReason
		}

		if err := CreateNotification(notificationCtx, pool, deposit.UserID, models.NotificationTypeDeposit, notificationTitle, notificationMessage, metadata); err != nil {
			log.Printf("UpdateDepositStatus: Failed to create notification: %v", err)
		}
	}()

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Deposit %s successfully", req.Status),
		"deposit": map[string]interface{}{
			"id":           depositID,
			"reference_id": deposit.ReferenceID,
			"amount":       deposit.Amount,
			"currency":     deposit.Currency,
			"status":       req.Status,
		},
	})
}

// getEmailSender returns email sender instance from global context
// This is a helper to get the email sender initialized in main.go
func getEmailSender() services.EmailSender {
	// For now, use console sender for development
	// In production, this should be injected via dependency injection or context
	return services.NewConsoleSender()
}
