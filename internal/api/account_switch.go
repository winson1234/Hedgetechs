package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/services"
	"brokerageProject/internal/utils"

	"github.com/google/uuid"
)

// ActivateAccountRequest represents the request to activate an account
type ActivateAccountRequest struct {
	AccountID string `json:"account_id"`
}

// ActivateAccountResponse represents the response after activating an account
type ActivateAccountResponse struct {
	Message  string         `json:"message"`
	Accounts []AccountBrief `json:"accounts"`
}

// AccountBrief represents brief account information
type AccountBrief struct {
	ID        uuid.UUID `json:"id"`
	AccountID string    `json:"account_id"`
	Type      string    `json:"type"`
	Status    string    `json:"status"`
	Currency  string    `json:"currency"`
	Balance   float64   `json:"balance"`
}

// HandleActivateAccount handles account activation/switching requests
func HandleActivateAccount(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context (set by auth middleware)
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	// Parse account ID from URL path
	// Expected format: /api/v1/accounts/{account_id}/activate
	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 5 {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid URL format")
		return
	}

	accountIDStr := pathParts[4] // Get the account ID from URL

	// Parse account ID
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid account ID format")
		return
	}

	// Switch account using service
	err = services.SwitchAccount(userID, accountID)
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", fmt.Sprintf("Failed to activate account: %v", err))
		return
	}

	// Fetch updated account list
	pool, err := database.GetPool()
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
		return
	}
	ctx := context.Background()

	query := `
		SELECT id, account_id, account_type, status, currency, balance
		FROM accounts
		WHERE user_id = $1
		ORDER BY created_at ASC
	`

	rows, err := pool.Query(ctx, query, userID)
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to fetch accounts")
		return
	}
	defer rows.Close()

	var accounts []AccountBrief
	for rows.Next() {
		var acc AccountBrief
		err := rows.Scan(&acc.ID, &acc.AccountID, &acc.Type, &acc.Status, &acc.Currency, &acc.Balance)
		if err != nil {
			continue
		}
		accounts = append(accounts, acc)
	}

	response := ActivateAccountResponse{
		Message:  "Account activated successfully",
		Accounts: accounts,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleDeactivateAllAccounts handles deactivating all accounts for a user
func HandleDeactivateAllAccounts(w http.ResponseWriter, r *http.Request) {
	// Get user ID from context
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	// Deactivate all accounts
	err = services.DeactivateAllAccounts(userID)
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", fmt.Sprintf("Failed to deactivate accounts: %v", err))
		return
	}

	response := map[string]string{
		"message": "All accounts deactivated successfully",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
