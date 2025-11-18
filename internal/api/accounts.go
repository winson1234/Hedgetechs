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

	// Generate account_id (format: ACC-12345678)
	var accountID string
	err = tx.QueryRow(ctx, `
		SELECT 'ACC-' || LPAD(FLOOR(RANDOM() * 99999999)::TEXT, 8, '0')
	`).Scan(&accountID)
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

	// Determine status: first account should be 'online', others 'offline'
	var accountStatus string
	var existingCount int
	err = tx.QueryRow(ctx, "SELECT COUNT(*) FROM accounts WHERE user_id = $1", userID).Scan(&existingCount)
	if err != nil {
		log.Printf("Failed to count existing accounts: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to check existing accounts")
		return
	}

	if existingCount == 0 {
		accountStatus = "online" // First account is online by default
	} else {
		accountStatus = "offline" // Additional accounts start offline
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

	// Update user's is_active status if this is the first account and it's online
	if accountStatus == "online" {
		_, err = tx.Exec(ctx, "UPDATE users SET is_active = true WHERE id = $1", userID)
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

		// Set account_number to account_id for backward compatibility
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
func getAccountByID(ctx context.Context, pool DBQuerier, accountID, userID uuid.UUID) (models.Account, error) {
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

	// Set account_number to account_id for backward compatibility
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
