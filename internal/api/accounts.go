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
	"github.com/jackc/pgx/v5/pgconn"
)

// CreateAccount handles POST /api/v1/accounts
// Protected endpoint that creates a new trading account for the authenticated user
func CreateAccount(w http.ResponseWriter, r *http.Request) {
	// Recover from any panics
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("CreateAccount: PANIC recovered: %v", rec)
			respondWithJSONError(w, http.StatusInternalServerError, "internal_error", fmt.Sprintf("internal server error: %v", rec))
		}
	}()

	// Extract user ID from context (injected by AuthMiddleware)
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		log.Printf("CreateAccount: Failed to get user ID from context: %v", err)
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}
	log.Printf("CreateAccount: UserID extracted: %v", userID)

	// Parse request body
	var req models.CreateAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("CreateAccount: Failed to decode request body: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body: "+err.Error())
		return
	}
	log.Printf("CreateAccount: Request parsed - Type: %v, Currency: %v, InitialBalance: %v", req.Type, req.Currency, req.InitialBalance)

	// Validate request
	if err := req.Validate(); err != nil {
		log.Printf("CreateAccount: Validation failed: %v", err)
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	// Get database pool
	pool, err := database.GetPool()
	if err != nil {
		log.Printf("CreateAccount: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}
	log.Printf("CreateAccount: Database pool obtained successfully")

	// Start a transaction
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("CreateAccount: Failed to begin transaction: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to begin transaction")
		return
	}
	log.Printf("CreateAccount: Transaction started successfully")
	defer tx.Rollback(ctx) // Rollback if not committed

	// Account creation limit removed - users can now create multiple accounts of any type

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
		log.Printf("Failed to count existing accounts - Error: %v, UserID: %v", err, userID)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("failed to check existing accounts: %v", err))
		return
	}

	if existingCount == 0 {
		accountStatus = "active" // First account is active by default
	} else {
		accountStatus = "deactivated" // Additional accounts start deactivated
	}

	// Generate account_id based on account type
	// Live accounts: 10001-19999 (5 digits, starts with 1)
	// Demo accounts: 1-9999 (5 digits, starts with 0 when displayed as 00001)
	var accountID int64
	maxAttempts := 10
	attempt := 0
	
	for attempt < maxAttempts {
		var maxAccountID *int64
		err = tx.QueryRow(ctx,
			`SELECT COALESCE(MAX(account_id), 0) FROM accounts WHERE account_type = $1::account_type_enum`,
			req.Type,
		).Scan(&maxAccountID)
		if err != nil {
			log.Printf("Failed to get max account_id - Error: %v, Type: %v", err, req.Type)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("failed to generate account ID: %v", err))
			return
		}

		if maxAccountID == nil {
			maxAccountID = new(int64)
			*maxAccountID = 0
		}

		if req.Type == models.AccountTypeLive {
			// Live accounts start at 10001
			if *maxAccountID < 10001 {
				accountID = 10001
			} else {
				accountID = *maxAccountID + 1
			}
			// Ensure it stays within range 10001-19999
			if accountID > 19999 {
				respondWithJSONError(w, http.StatusInternalServerError, "account_limit", "maximum number of live accounts reached")
				return
			}
		} else {
			// Demo accounts start at 1
			if *maxAccountID < 1 {
				accountID = 1
			} else {
				accountID = *maxAccountID + 1
			}
			// Ensure it stays within range 1-9999
			if accountID > 9999 {
				respondWithJSONError(w, http.StatusInternalServerError, "account_limit", "maximum number of demo accounts reached")
				return
			}
		}

		// Check if account_id already exists (collision check)
		var exists bool
		err = tx.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM accounts WHERE account_id = $1)`,
			accountID,
		).Scan(&exists)
		if err != nil {
			log.Printf("Failed to check account_id existence - Error: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("failed to verify account ID: %v", err))
			return
		}

		if !exists {
			break // Found a unique account_id
		}

		attempt++
		if attempt >= maxAttempts {
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to generate unique account ID after multiple attempts")
			return
		}
	}

	// Insert account into database with generated account_id
	// Cast string values to enum types for PostgreSQL
	_, err = tx.Exec(ctx,
		`INSERT INTO accounts (id, user_id, account_id, account_type, currency, balance, status, last_updated, created_at)
		 VALUES ($1, $2, $3, $4::account_type_enum, $5, $6, $7::account_status_enum, NOW(), NOW())`,
		account.ID, account.UserID, accountID, account.Type, account.Currency, initialBalance, accountStatus,
	)
	if err != nil {
		log.Printf("Failed to insert account - Error: %v, AccountID: %v, UserID: %v, Type: %v, Currency: %v, Balance: %v, Status: %v", 
			err, account.ID, account.UserID, account.Type, account.Currency, initialBalance, accountStatus)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("failed to create account: %v", err))
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
		log.Printf("Failed to insert balance - Error: %v, BalanceID: %v, AccountID: %v, Currency: %v, Amount: %v", 
			err, balance.ID, balance.AccountID, balance.Currency, balance.Amount)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("failed to create balance: %v", err))
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
		var balance float64
		var lastUpdated, lastLogin *time.Time

		err := rows.Scan(
			&account.ID, &account.UserID, &account.AccountID,
			&account.Type, &account.Currency, &balance,
			&account.Status, &lastUpdated, &lastLogin, &account.CreatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan account: %v", err)
			continue
		}

		// Populate account_number (deprecated alias)
		account.AccountNumber = account.AccountID

		// Sync balances table with accounts.balance if missing
		// This handles cases where deposits were approved before the balances table was updated
		if err := syncAccountBalanceToBalancesTable(ctx, pool, account.ID, account.Currency, balance); err != nil {
			log.Printf("Failed to sync balance for account %s: %v", account.ID, err)
			// Continue anyway - this is a best-effort sync
		}

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
	Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
}

// Helper function to get account by ID
func getAccountByID(ctx context.Context, pool DBQuerier, accountID uuid.UUID, userID int64) (models.Account, error) {
	var account models.Account
	var balance float64
	var lastUpdated, lastLogin *time.Time

	err := pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, account_type, currency, balance, status,
		        last_updated, last_login, created_at
		 FROM accounts
		 WHERE id = $1 AND user_id = $2`,
		accountID, userID,
	).Scan(
		&account.ID, &account.UserID, &account.AccountID,
		&account.Type, &account.Currency, &balance,
		&account.Status, &lastUpdated, &lastLogin, &account.CreatedAt,
	)
	if err != nil {
		return account, fmt.Errorf("failed to fetch account: %w", err)
	}

	// Populate account_number (deprecated alias)
	account.AccountNumber = account.AccountID

	// Fetch balances (still used for multi-currency support)
	balances, err := getBalancesForAccount(ctx, pool, accountID)
	if err != nil {
		return account, fmt.Errorf("failed to fetch balances: %w", err)
	}

	// Sync balances table with accounts.balance if missing
	// This handles cases where deposits were approved before the balances table was updated
	if err := syncAccountBalanceToBalancesTable(ctx, pool, accountID, account.Currency, balance); err != nil {
		log.Printf("Failed to sync balance for account %s: %v", accountID, err)
		// Continue anyway - this is a best-effort sync
	}

	// Re-fetch balances after sync
	balances, err = getBalancesForAccount(ctx, pool, accountID)
	if err != nil {
		return account, fmt.Errorf("failed to fetch balances after sync: %w", err)
	}
	account.Balances = balances

	return account, nil
}

// syncAccountBalanceToBalancesTable ensures the balances table has an entry matching accounts.balance
// for the account's currency. This handles legacy data where deposits updated accounts.balance but not balances.
func syncAccountBalanceToBalancesTable(ctx context.Context, pool DBQuerier, accountID uuid.UUID, currency string, accountBalance float64) error {
	// Check if balance entry exists for this account and currency
	var existingAmount float64
	err := pool.QueryRow(ctx,
		`SELECT amount FROM balances WHERE account_id = $1 AND currency = $2`,
		accountID, currency,
	).Scan(&existingAmount)

	if err == pgx.ErrNoRows {
		// No balance entry exists - create one from accounts.balance
		if accountBalance > 0 {
			_, err = pool.Exec(ctx,
				`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
				 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
				accountID, currency, accountBalance,
			)
			if err != nil {
				return fmt.Errorf("failed to create balance entry: %w", err)
			}
			log.Printf("Synced balance: Created balance entry for account %s, currency %s, amount %.2f", accountID, currency, accountBalance)
		}
		return nil
	} else if err != nil {
		return fmt.Errorf("failed to check existing balance: %w", err)
	}

	// Balance entry exists - check if it needs syncing
	// If accounts.balance is significantly different, update balances table
	// (allowing for small floating point differences)
	diff := accountBalance - existingAmount
	if diff > 0.01 || diff < -0.01 {
		_, err = pool.Exec(ctx,
			`UPDATE balances SET amount = $1, updated_at = NOW() WHERE account_id = $2 AND currency = $3`,
			accountBalance, accountID, currency,
		)
		if err != nil {
			return fmt.Errorf("failed to update balance entry: %w", err)
		}
		log.Printf("Synced balance: Updated balance entry for account %s, currency %s from %.2f to %.2f", accountID, currency, existingAmount, accountBalance)
	}

	return nil
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
	switch currentStatus {
	case "active":
		newStatus = "deactivated"
	case "deactivated":
		// Activating this account - deactivate all other accounts first
		_, err = tx.Exec(ctx,
			`UPDATE accounts SET status = $1::account_status_enum, last_updated = NOW()
			 WHERE user_id = $2 AND status = $3::account_status_enum`,
			"deactivated", userID, "active",
		)
		if err != nil {
			log.Printf("Failed to deactivate other accounts: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to deactivate other accounts")
			return
		}
		newStatus = "active"
	case "suspended":
		// Reactivating suspended account - deactivate all other accounts first
		_, err = tx.Exec(ctx,
			`UPDATE accounts SET status = $1::account_status_enum, last_updated = NOW()
			 WHERE user_id = $2 AND status = $3::account_status_enum`,
			"deactivated", userID, "active",
		)
		if err != nil {
			log.Printf("Failed to deactivate other accounts: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to deactivate other accounts")
			return
		}
		newStatus = "active"
	default:
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "invalid account status")
		return
	}

	// Update target account status
	_, err = tx.Exec(ctx,
		`UPDATE accounts SET status = $1::account_status_enum, last_updated = NOW() WHERE id = $2`,
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
		var balance float64
		var lastUpdated, lastLogin *time.Time

		err := rows.Scan(
			&account.ID, &account.UserID, &account.AccountID,
			&account.Type, &account.Currency, &balance,
			&account.Status, &lastUpdated, &lastLogin, &account.CreatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan account: %v", err)
			continue
		}

		account.AccountNumber = account.AccountID

		// Sync balances table with accounts.balance if missing
		if err := syncAccountBalanceToBalancesTable(ctx, pool, account.ID, account.Currency, balance); err != nil {
			log.Printf("Failed to sync balance for account %s: %v", account.ID, err)
			// Continue anyway - this is a best-effort sync
		}

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
