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

// CreateAccount handles POST /api/v1/accounts
// Protected endpoint that creates a new trading account for the authenticated user
func CreateAccount(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context (injected by AuthMiddleware)
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Parse request body
	var req models.CreateAccountRequest
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

	// Start a transaction
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to begin transaction")
		return
	}
	defer tx.Rollback(ctx) // Rollback if not committed

	// Generate account_id using database function (format: ACC-1234567)
	var accountID string
	err = tx.QueryRow(ctx, `SELECT generate_account_id($1)`, req.Type).Scan(&accountID)
	if err != nil {
		log.Printf("Failed to generate account ID: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate account ID")
		return
	}

	// Create account record with new schema
	account := models.Account{
		ID:       uuid.New(),
		UserID:   userID,
		Type:     req.Type,
		Currency: req.Currency,
	}

	// Set initial balance
	initialBalance := req.InitialBalance
	if initialBalance == 0 {
		initialBalance = 0 // Start with 0 balance
	}

	// Determine status: first account should be 'active', others 'deactivated'
	var accountStatus string
	var existingCount int
	err = tx.QueryRow(ctx, "SELECT COUNT(*) FROM accounts WHERE user_id = $1", userID).Scan(&existingCount)
	if err != nil {
		log.Printf("Failed to count existing accounts: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to check existing accounts")
		return
	}

	if existingCount == 0 {
		accountStatus = "active" // First account is active by default
	} else {
		accountStatus = "deactivated" // Additional accounts start deactivated
	}

	// Insert account into database (new schema: account_id, account_type, balance, status)
	_, err = tx.Exec(ctx,
		`INSERT INTO accounts (id, user_id, account_id, account_type, currency, balance, status, last_updated, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
		account.ID, account.UserID, accountID, account.Type, account.Currency, initialBalance, accountStatus,
	)
	if err != nil {
		log.Printf("Failed to insert account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create account")
		return
	}

	// Create initial balance record
	balance := models.Balance{
		ID:        uuid.New(),
		AccountID: account.ID,
		Currency:  req.Currency,
		Amount:    req.InitialBalance,
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, NOW(), NOW())`,
		balance.ID, balance.AccountID, balance.Currency, balance.Amount,
	)
	if err != nil {
		log.Printf("Failed to insert balance: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create balance")
		return
	}

	// Update user's is_active status if this is the first account and it's active
	if accountStatus == "active" {
		_, err = tx.Exec(ctx, "UPDATE users SET is_active = true WHERE user_id = $1", userID)
		if err != nil {
			log.Printf("Failed to update user is_active status: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update user status")
			return
		}
	}

	// Commit the transaction
	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit transaction")
		return
	}

	// Fetch the created account with all its data
	createdAccount, err := getAccountByID(r.Context(), pool, account.ID, userID)
	if err != nil {
		log.Printf("Failed to fetch created account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "account created but failed to fetch details")
		return
	}

	// Return the created account
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"account": createdAccount,
	})
}

// GetAccounts handles GET /api/v1/accounts
// Protected endpoint that fetches all accounts for the authenticated user
func GetAccounts(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context (injected by AuthMiddleware)
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
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

	// Fetch all accounts for the user (new schema)
	rows, err := pool.Query(ctx,
		`SELECT id, user_id, account_id, account_type, currency, balance, status, 
		        last_updated, last_login, created_at
		 FROM accounts
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		log.Printf("Failed to query accounts: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch accounts")
		return
	}
	defer rows.Close()

	// Parse accounts
	var accounts []models.Account
	for rows.Next() {
		var account models.Account
		var accountIDStr string
		var balance float64
		var lastUpdated, lastLogin *time.Time

		err := rows.Scan(
			&account.ID, &account.UserID, &accountIDStr,
			&account.Type, &account.Currency, &balance,
			&account.Status, &lastUpdated, &lastLogin, &account.CreatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan account: %v", err)
			continue
		}

		// Populate both account_id (new) and account_number (deprecated) fields
		account.AccountID = accountIDStr
		account.AccountNumber = accountIDStr

		// Fetch balances for this account
		balances, err := getBalancesForAccount(ctx, pool, account.ID)
		if err != nil {
			log.Printf("Failed to fetch balances for account %s: %v", account.ID, err)
			// Continue with empty balances rather than failing the whole request
			account.Balances = []models.Balance{}
		} else {
			account.Balances = balances
		}

		// Calculate margin metrics for this account
		marginService := services.GetGlobalMarginService()
		if marginService != nil {
			metrics, err := marginService.CalculateMargin(account.ID)
			if err != nil {
				log.Printf("Failed to calculate margin for account %s: %v", account.ID, err)
				// Continue without margin data rather than failing the request
			} else {
				// Populate transient margin fields
				account.Equity = &metrics.Equity
				account.UsedMargin = &metrics.UsedMargin
				account.FreeMargin = &metrics.FreeMargin
				account.MarginLevel = &metrics.MarginLevel
				account.UnrealizedPnL = &metrics.UnrealizedPnL
			}
		}

		accounts = append(accounts, account)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Row iteration error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "error processing accounts")
		return
	}

	// Return empty array if no accounts found
	if accounts == nil {
		accounts = []models.Account{}
	}

	// Return accounts
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"accounts": accounts,
	})
}

// DBQuerier interface for database operations
type DBQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

// Helper function to get account by ID
func getAccountByID(ctx context.Context, pool DBQuerier, accountID uuid.UUID, userID int64) (models.Account, error) {
	var account models.Account
	var accountIDStr string
	var balance float64
	var lastUpdated, lastLogin *time.Time

	err := pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, account_type, currency, balance, status,
		        last_updated, last_login, created_at
		 FROM accounts
		 WHERE id = $1 AND user_id = $2`,
		accountID, userID,
	).Scan(
		&account.ID, &account.UserID, &accountIDStr,
		&account.Type, &account.Currency, &balance,
		&account.Status, &lastUpdated, &lastLogin, &account.CreatedAt,
	)
	if err != nil {
		return account, fmt.Errorf("failed to fetch account: %w", err)
	}

	// Populate both account_id (new) and account_number (deprecated) fields
	account.AccountID = accountIDStr
	account.AccountNumber = accountIDStr

	// Fetch balances (still used for multi-currency support)
	balances, err := getBalancesForAccount(ctx, pool, accountID)
	if err != nil {
		return account, fmt.Errorf("failed to fetch balances: %w", err)
	}
	account.Balances = balances

	return account, nil
}

// Helper function to get balances for an account
func getBalancesForAccount(ctx context.Context, pool DBQuerier, accountID uuid.UUID) ([]models.Balance, error) {
	rows, err := pool.Query(ctx,
		`SELECT id, account_id, currency, amount, created_at, updated_at
		 FROM balances
		 WHERE account_id = $1
		 ORDER BY currency ASC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var balances []models.Balance
	for rows.Next() {
		var balance models.Balance
		err := rows.Scan(
			&balance.ID, &balance.AccountID, &balance.Currency,
			&balance.Amount, &balance.CreatedAt, &balance.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		balances = append(balances, balance)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Return empty array instead of nil
	if balances == nil {
		balances = []models.Balance{}
	}

	return balances, nil
}

// Helper function to send JSON error responses
func respondWithJSONError(w http.ResponseWriter, statusCode int, errorType, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": false,
		"error":   errorType,
		"message": message,
		"code":    statusCode,
	})
}

// UpdateAccountMetadata handles PATCH /api/v1/accounts/:id
// Protected endpoint that updates account personalization (nickname, color, icon)
func UpdateAccountMetadata(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context (injected by AuthMiddleware)
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Extract account ID from URL query parameter
	accountIDStr := r.URL.Query().Get("id")
	if accountIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "account ID is required")
		return
	}

	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid account ID format")
		return
	}

	// Parse request body
	var req models.UpdateAccountMetadataRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body: "+err.Error())
		return
	}

	// Validate that at least one field is provided
	if req.Nickname == nil && req.Color == nil && req.Icon == nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "at least one field (nickname, color, icon) must be provided")
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

	// Update account metadata
	_, err = pool.Exec(ctx,
		`UPDATE accounts
		 SET nickname = COALESCE($1, nickname),
		     color = COALESCE($2, color),
		     icon = COALESCE($3, icon),
		     updated_at = NOW()
		 WHERE id = $4`,
		req.Nickname, req.Color, req.Icon, accountID,
	)
	if err != nil {
		log.Printf("Failed to update account metadata: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update account metadata")
		return
	}

	// Fetch updated account
	updatedAccount, err := getAccountByID(ctx, pool, accountID, userID)
	if err != nil {
		log.Printf("Failed to fetch updated account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "account updated but failed to fetch details")
		return
	}

	// Return updated account
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "account metadata updated successfully",
		"account": updatedAccount,
	})
}

// ToggleAccountStatus handles POST /api/v1/accounts/toggle-status?account_id={uuid}
// Toggles account status between 'active' and 'deactivated'
// When activating an account, it deactivates all other accounts (single active account policy)
func ToggleAccountStatus(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Get account_id from query params
	accountID := r.URL.Query().Get("account_id")
	if accountID == "" {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "account_id is required")
		return
	}

	// Validate UUID format
	if _, err := uuid.Parse(accountID); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "invalid account_id format")
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

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to start transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Verify account belongs to user and get current status
	var currentStatus string
	err = tx.QueryRow(ctx,
		`SELECT status FROM accounts WHERE id = $1 AND user_id = $2`,
		accountID, userID,
	).Scan(&currentStatus)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
			return
		}
		log.Printf("Failed to fetch account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch account")
		return
	}

	// Determine new status
	var newStatus string
	if currentStatus == "active" {
		newStatus = "deactivated"
	} else if currentStatus == "deactivated" {
		// Activating this account - deactivate all other accounts first
		_, err = tx.Exec(ctx,
			`UPDATE accounts SET status = $1, last_updated = NOW()
			 WHERE user_id = $2 AND status = $3`,
			"deactivated", userID, "active",
		)
		if err != nil {
			log.Printf("Failed to deactivate other accounts: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to deactivate other accounts")
			return
		}
		newStatus = "active"
	} else if currentStatus == "suspended" {
		// Reactivating suspended account - deactivate all other accounts first
		_, err = tx.Exec(ctx,
			`UPDATE accounts SET status = $1, last_updated = NOW()
			 WHERE user_id = $2 AND status = $3`,
			"deactivated", userID, "active",
		)
		if err != nil {
			log.Printf("Failed to deactivate other accounts: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to deactivate other accounts")
			return
		}
		newStatus = "active"
	} else {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "invalid account status")
		return
	}

	// Update target account status
	_, err = tx.Exec(ctx,
		`UPDATE accounts SET status = $1, last_updated = NOW() WHERE id = $2`,
		newStatus, accountID,
	)
	if err != nil {
		log.Printf("Failed to update account status: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update account status")
		return
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit changes")
		return
	}

	// Fetch all updated accounts with balances and margin info
	rows, err := pool.Query(ctx,
		`SELECT id, user_id, account_id, account_type, currency, balance, status,
		        last_updated, last_login, created_at
		 FROM accounts
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		log.Printf("Failed to fetch accounts: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch updated accounts")
		return
	}
	defer rows.Close()

	// Parse accounts
	var accounts []models.Account
	for rows.Next() {
		var account models.Account
		var accountIDStr string
		var balance float64
		var lastUpdated, lastLogin *time.Time

		err := rows.Scan(
			&account.ID, &account.UserID, &accountIDStr,
			&account.Type, &account.Currency, &balance,
			&account.Status, &lastUpdated, &lastLogin, &account.CreatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan account: %v", err)
			continue
		}

		account.AccountID = accountIDStr
		account.AccountNumber = accountIDStr

		// Fetch balances
		balances, err := getBalancesForAccount(ctx, pool, account.ID)
		if err != nil {
			log.Printf("Failed to fetch balances for account %s: %v", account.ID, err)
			account.Balances = []models.Balance{}
		} else {
			account.Balances = balances
		}

		// Calculate margin metrics
		marginService := services.GetGlobalMarginService()
		if marginService != nil {
			metrics, err := marginService.CalculateMargin(account.ID)
			if err != nil {
				log.Printf("Failed to calculate margin for account %s: %v", account.ID, err)
			} else {
				account.Equity = &metrics.Equity
				account.UsedMargin = &metrics.UsedMargin
				account.FreeMargin = &metrics.FreeMargin
				account.MarginLevel = &metrics.MarginLevel
				account.UnrealizedPnL = &metrics.UnrealizedPnL
			}
		}

		accounts = append(accounts, account)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  fmt.Sprintf("account status updated to %s", newStatus),
		"accounts": accounts,
	})
}

// EditDemoBalance handles POST /api/v1/accounts/demo/edit-balance
// Allows editing demo account balances for testing purposes
func EditDemoBalance(w http.ResponseWriter, r *http.Request) {
	// Extract user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	// Parse request body
	var req struct {
		AccountID  string  `json:"account_id"`
		NewBalance float64 `json:"new_balance"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "invalid request body")
		return
	}

	// Validate inputs
	if req.AccountID == "" {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "account_id is required")
		return
	}

	if req.NewBalance < 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "new_balance must be non-negative")
		return
	}

	// Validate UUID format
	accountID, err := uuid.Parse(req.AccountID)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "invalid account_id format")
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

	// Start transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to start transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to start transaction")
		return
	}
	defer tx.Rollback(ctx)

	// Verify account belongs to user and is a demo account
	var accountType, accountCurrency string
	err = tx.QueryRow(ctx,
		`SELECT account_type, currency FROM accounts WHERE id = $1 AND user_id = $2`,
		accountID, userID,
	).Scan(&accountType, &accountCurrency)
	if err != nil {
		if err == pgx.ErrNoRows {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
			return
		}
		log.Printf("Failed to fetch account: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch account")
		return
	}

	// Only allow editing demo account balances
	if accountType != "demo" {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "can only edit demo account balances")
		return
	}

	// Update balance in balances table (UPSERT)
	_, err = tx.Exec(ctx,
		`INSERT INTO balances (account_id, currency, amount, created_at, updated_at)
		 VALUES ($1, $2, $3, NOW(), NOW())
		 ON CONFLICT (account_id, currency)
		 DO UPDATE SET amount = $3, updated_at = NOW()`,
		accountID, accountCurrency, req.NewBalance,
	)
	if err != nil {
		log.Printf("Failed to update balance: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update balance")
		return
	}

	// Update balance in accounts table (for quick queries)
	_, err = tx.Exec(ctx,
		`UPDATE accounts SET balance = $1, last_updated = NOW() WHERE id = $2`,
		req.NewBalance, accountID,
	)
	if err != nil {
		log.Printf("Failed to update account balance: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update account balance")
		return
	}

	// Create audit transaction record
	transactionNumber := fmt.Sprintf("TXN-%d", time.Now().UnixNano())
	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (account_id, transaction_number, type, currency, amount, status, description, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
		accountID, transactionNumber, "deposit", accountCurrency, req.NewBalance,
		"completed", fmt.Sprintf("Demo Balance Adjustment to %s %.2f", accountCurrency, req.NewBalance),
	)
	if err != nil {
		log.Printf("Failed to create transaction record: %v", err)
		// Continue anyway - transaction record is just for audit
	}

	// Commit transaction
	if err = tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to commit changes")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Demo balance updated to %s %.2f", accountCurrency, req.NewBalance),
	})
}
