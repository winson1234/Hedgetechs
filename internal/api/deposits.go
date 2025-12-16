package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	// Deposit limits
	MinDepositAmount = 5.0
	MaxDepositAmount = 100000.0

	// File upload settings
	MaxFileSize      = 10 * 1024 * 1024 // 10MB
	AllowedMimeTypes = "image/jpeg,image/png,image/jpg,application/pdf"
)

// CreateDeposit handles POST /api/v1/deposits
// Creates a new deposit request with pending status
func CreateDeposit(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("CreateDeposit: PANIC recovered: %v", rec)
			respondWithJSONError(w, http.StatusInternalServerError, "internal_error", fmt.Sprintf("internal server error: %v", rec))
		}
	}()

	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		log.Printf("CreateDeposit: Failed to get user ID from context: %v", err)
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Parse request body
	var req models.CreateDepositRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("CreateDeposit: Failed to decode request body: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body: "+err.Error())
		return
	}

	// Validate request
	if err := req.Validate(); err != nil {
		log.Printf("CreateDeposit: Validation failed: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("CreateDeposit: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("CreateDeposit: Failed to begin transaction: %v", err)
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
		log.Printf("CreateDeposit: Failed to fetch account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify account")
		return
	}

	if accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Check if account is active (only active accounts can receive deposits)
	if accountStatus != "active" {
		respondWithJSONError(w, http.StatusBadRequest, "account_inactive", "account must be active to receive deposits")
		return
	}

	// Check if account is demo (demo accounts cannot receive real deposits)
	if accountType == "demo" {
		respondWithJSONError(w, http.StatusBadRequest, "demo_account", "demo accounts cannot receive real deposits")
		return
	}

	// Check if user is active (check users table)
	var isActive bool
	err = tx.QueryRow(ctx,
		`SELECT is_active FROM users WHERE user_id = $1`,
		userID,
	).Scan(&isActive)
	if err != nil {
		log.Printf("CreateDeposit: Failed to check user status: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify user status")
		return
	}

	if !isActive {
		respondWithJSONError(w, http.StatusForbidden, "user_inactive", "user account is not active")
		return
	}

	// Marshal payment_details to JSON string for JSONB column
	var paymentDetailsValue interface{}
	if req.PaymentDetails != nil && len(req.PaymentDetails) > 0 {
		paymentDetailsJSON, err := json.Marshal(req.PaymentDetails)
		if err != nil {
			log.Printf("CreateDeposit: Failed to marshal payment details: %v", err)
			respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid payment details format")
			return
		}
		paymentDetailsValue = string(paymentDetailsJSON)
	} else {
		paymentDetailsValue = nil // Will be inserted as NULL
	}

	// Generate unique deposit reference ID
	var referenceID string
	err = tx.QueryRow(ctx, "SELECT generate_deposit_reference_id()").Scan(&referenceID)
	if err != nil {
		log.Printf("CreateDeposit: Failed to generate reference ID: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate deposit reference ID")
		return
	}

	// Get client IP address
	clientIP := getClientIP(r)

	// Create deposit record
	depositID := uuid.New()
	status := models.DepositStatusPending

	_, err = tx.Exec(ctx,
		`INSERT INTO deposits (id, user_id, account_id, reference_id, payment_method, amount, currency, payment_details, status, client_ip, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5::payment_method, $6, $7, $8, $9::deposit_status, $10, NOW(), NOW())`,
		depositID, userID, req.AccountID, referenceID, req.PaymentMethod, req.Amount, req.Currency,
		paymentDetailsValue, status, clientIP,
	)
	if err != nil {
		log.Printf("CreateDeposit: Failed to insert deposit: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create deposit")
		return
	}

	// Generate transaction number for ledger entry
	var transactionNumber string
	err = tx.QueryRow(ctx, "SELECT generate_transaction_number()").Scan(&transactionNumber)
	if err != nil {
		log.Printf("CreateDeposit: Failed to generate transaction number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate transaction number")
		return
	}

	// Create pending ledger entry in transactions table
	transactionID := uuid.New()
	description := fmt.Sprintf("Deposit request %s - %s %.2f (Pending Review)", referenceID, req.Currency, req.Amount)

	metadataMap := map[string]interface{}{
		"deposit_id":   depositID.String(),
		"reference_id": referenceID,
	}
	metadataBytes, _ := json.Marshal(metadataMap)
	metadataValue := string(metadataBytes)

	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (id, account_id, transaction_number, type, currency, amount, status, description, metadata, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
		transactionID, req.AccountID, transactionNumber, models.TransactionTypeDeposit, req.Currency,
		req.Amount, models.TransactionStatusPending, description,
		metadataValue,
	)
	if err != nil {
		log.Printf("CreateDeposit: Failed to create transaction entry: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create ledger entry")
		return
	}

	// Update deposit with transaction_id
	_, err = tx.Exec(ctx,
		`UPDATE deposits SET transaction_id = $1 WHERE id = $2`,
		transactionID, depositID,
	)
	if err != nil {
		log.Printf("CreateDeposit: Failed to link transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to link transaction")
		return
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("CreateDeposit: Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit transaction")
		return
	}

	// Fetch created deposit
	deposit, err := getDepositByID(ctx, pool, depositID, userID)
	if err != nil {
		log.Printf("CreateDeposit: Failed to fetch created deposit: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "deposit created but failed to fetch details")
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"deposit": deposit,
		"message": "Deposit request created successfully. Please upload payment receipt for review.",
	})
}

// UploadReceipt handles POST /api/v1/deposits/:id/receipt
// Uploads a payment receipt file (image/PDF) for a deposit request directly to the database
func UploadReceipt(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("UploadReceipt: PANIC recovered: %v", rec)
			respondWithJSONError(w, http.StatusInternalServerError, "internal_error", fmt.Sprintf("internal server error: %v", rec))
		}
	}()

	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		log.Printf("UploadReceipt: Failed to get user ID from context: %v", err)
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Extract deposit ID from URL path
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 4 || pathParts[0] != "api" || pathParts[1] != "v1" || pathParts[2] != "deposits" || pathParts[4] != "receipt" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid URL path format")
		return
	}

	depositIDStr := pathParts[3]
	depositID, err := uuid.Parse(depositIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid deposit ID format")
		return
	}

	// Parse multipart form (max 10MB)
	err = r.ParseMultipartForm(MaxFileSize)
	if err != nil {
		log.Printf("UploadReceipt: Failed to parse multipart form: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "failed to parse form data")
		return
	}

	// Get file from form
	file, header, err := r.FormFile("receipt")
	if err != nil {
		log.Printf("UploadReceipt: Failed to get file from form: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "receipt file is required")
		return
	}
	defer file.Close()

	// Validate file size
	if header.Size > MaxFileSize {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", fmt.Sprintf("file size exceeds maximum of %d bytes", MaxFileSize))
		return
	}

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	allowedTypes := []string{"image/jpeg", "image/png", "image/jpg", "application/pdf"}
	isValidType := false
	for _, allowedType := range allowedTypes {
		if contentType == allowedType {
			isValidType = true
			break
		}
	}

	// Also check file extension as fallback
	if !isValidType {
		ext := strings.ToLower(filepath.Ext(header.Filename))
		validExts := []string{".jpg", ".jpeg", ".png", ".pdf"}
		for _, validExt := range validExts {
			if ext == validExt {
				isValidType = true
				if ext == ".pdf" {
					contentType = "application/pdf"
				} else {
					contentType = "image/jpeg" // Generic fallback
				}
				break
			}
		}
	}

	if !isValidType {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "invalid file type. Only JPG, PNG, and PDF files are allowed")
		return
	}

	// Read file content into memory
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		log.Printf("UploadReceipt: Failed to read file: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "upload_error", "failed to read file content")
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("UploadReceipt: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Verify deposit belongs to user
	var depositUserID int64
	var depositStatus string
	err = pool.QueryRow(ctx,
		`SELECT user_id, status FROM deposits WHERE id = $1`,
		depositID,
	).Scan(&depositUserID, &depositStatus)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "deposit not found")
			return
		}
		log.Printf("UploadReceipt: Failed to fetch deposit: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to verify deposit")
		return
	}

	if depositUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "deposit does not belong to user")
		return
	}

	// Check if deposit is still pending (can only upload receipt for pending deposits)
	if depositStatus != "pending" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_status", "can only upload receipt for pending deposits")
		return
	}

	// Update deposit record with file data (BLOB)
	// We no longer save to disk
	_, err = pool.Exec(ctx,
		`UPDATE deposits SET receipt_data = $1, receipt_mime_type = $2, updated_at = NOW() WHERE id = $3`,
		fileBytes, contentType, depositID,
	)
	if err != nil {
		log.Printf("UploadReceipt: Failed to update deposit with receipt: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to save receipt")
		return
	}

	// Fetch updated deposit
	deposit, err := getDepositByID(ctx, pool, depositID, userID)
	if err != nil {
		log.Printf("UploadReceipt: Failed to fetch updated deposit: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "receipt uploaded but failed to fetch deposit")
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"deposit": deposit,
		"message": "Receipt uploaded successfully. Your deposit is pending admin review.",
	})
}

// GetDeposits handles GET /api/v1/deposits?account_id={uuid}
// Returns all deposits for a specific account
func GetDeposits(w http.ResponseWriter, r *http.Request) {
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

	// Fetch deposits
	// NOTE: We do NOT fetch receipt_data here (too heavy). We only fetch receipt_mime_type.
	rows, err := pool.Query(ctx,
		`SELECT id, user_id, account_id, reference_id, payment_method, amount, currency, 
		        receipt_mime_type, payment_details, status, transaction_id, admin_notes,
		        client_ip, admin_ip, approved_at, rejected_at, approved_by, rejected_by,
		        created_at, updated_at
		 FROM deposits
		 WHERE account_id = $1
		 ORDER BY created_at DESC
		 LIMIT 100`,
		accountID,
	)
	if err != nil {
		log.Printf("Failed to query deposits: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch deposits")
		return
	}
	defer rows.Close()

	var deposits []models.Deposit
	for rows.Next() {
		var deposit models.Deposit
		var receiptMimeType *string
		var paymentDetailsJSON []byte
		var adminNotes *string
		var clientIP *string
		var adminIP *string
		var approvedAt *time.Time
		var rejectedAt *time.Time
		var approvedBy *int64
		var rejectedBy *int64

		err := rows.Scan(
			&deposit.ID, &deposit.UserID, &deposit.AccountID, &deposit.ReferenceID,
			&deposit.PaymentMethod, &deposit.Amount, &deposit.Currency,
			&receiptMimeType, &paymentDetailsJSON, &deposit.Status,
			&deposit.TransactionID, &adminNotes,
			&clientIP, &adminIP, &approvedAt, &rejectedAt, &approvedBy, &rejectedBy,
			&deposit.CreatedAt, &deposit.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan deposit: %v", err)
			continue
		}

		// Ensure your model has this field or use a wrapper struct
		// deposit.ReceiptMimeType = receiptMimeType
		deposit.AdminNotes = adminNotes
		deposit.ClientIP = clientIP
		deposit.AdminIP = adminIP
		deposit.ApprovedAt = approvedAt
		deposit.RejectedAt = rejectedAt
		deposit.ApprovedBy = approvedBy
		deposit.RejectedBy = rejectedBy

		// Parse payment_details JSON
		if len(paymentDetailsJSON) > 0 {
			if err := json.Unmarshal(paymentDetailsJSON, &deposit.PaymentDetails); err != nil {
				log.Printf("Failed to parse payment_details: %v", err)
			}
		}

		deposits = append(deposits, deposit)
	}

	if deposits == nil {
		deposits = []models.Deposit{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"deposits": deposits,
	})
}

// Helper function to get deposit by ID
func getDepositByID(ctx context.Context, pool DBQuerier, depositID uuid.UUID, userID int64) (models.Deposit, error) {
	var deposit models.Deposit
	var receiptMimeType *string
	var paymentDetailsJSON []byte
	var adminNotes *string
	var clientIP *string
	var adminIP *string
	var approvedAt *time.Time
	var rejectedAt *time.Time
	var approvedBy *int64
	var rejectedBy *int64

	// NOTE: Changed receipt_file_path to receipt_mime_type
	err := pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, reference_id, payment_method, amount, currency,
		        receipt_mime_type, payment_details, status, transaction_id, admin_notes,
		        client_ip, admin_ip, approved_at, rejected_at, approved_by, rejected_by,
		        created_at, updated_at
		 FROM deposits
		 WHERE id = $1 AND user_id = $2`,
		depositID, userID,
	).Scan(
		&deposit.ID, &deposit.UserID, &deposit.AccountID, &deposit.ReferenceID,
		&deposit.PaymentMethod, &deposit.Amount, &deposit.Currency,
		&receiptMimeType, &paymentDetailsJSON, &deposit.Status,
		&deposit.TransactionID, &adminNotes,
		&clientIP, &adminIP, &approvedAt, &rejectedAt, &approvedBy, &rejectedBy,
		&deposit.CreatedAt, &deposit.UpdatedAt,
	)
	if err != nil {
		return deposit, fmt.Errorf("failed to fetch deposit: %w", err)
	}

	// Ensure your model has this field
	// deposit.ReceiptMimeType = receiptMimeType
	deposit.AdminNotes = adminNotes
	deposit.ClientIP = clientIP
	deposit.AdminIP = adminIP
	deposit.ApprovedAt = approvedAt
	deposit.RejectedAt = rejectedAt
	deposit.ApprovedBy = approvedBy
	deposit.RejectedBy = rejectedBy

	// Parse payment_details JSON
	if len(paymentDetailsJSON) > 0 {
		if err := json.Unmarshal(paymentDetailsJSON, &deposit.PaymentDetails); err != nil {
			log.Printf("Failed to parse payment_details: %v", err)
		}
	}

	return deposit, nil
}

// getClientIP extracts the client's IP address from the request
// It checks X-Forwarded-For, X-Real-IP headers before falling back to RemoteAddr
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (may contain multiple IPs if behind proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP (original client)
		ips := strings.Split(xff, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fallback to RemoteAddr (format: "ip:port")
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	return ip
}