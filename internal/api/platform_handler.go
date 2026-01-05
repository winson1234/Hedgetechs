package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"brokerageProject/internal/database"

	"github.com/jackc/pgx/v5"
)

// GetPlatformWalletAddress handles GET /api/v1/platform/wallet-address
// Returns the platform's USDT TRC20 wallet address from platform_settings
func GetPlatformWalletAddress(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondWithJSONError(w, http.StatusMethodNotAllowed, "method_not_allowed", "only GET method is allowed")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		log.Printf("GetPlatformWalletAddress: Database pool error: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "database connection error")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Default setting key for wallet address
	settingKey := "usdt_trc20_wallet_address"

	var walletAddress string
	err = pool.QueryRow(ctx, "SELECT value FROM platform_settings WHERE key = $1", settingKey).Scan(&walletAddress)
	if err != nil {
		if err == pgx.ErrNoRows {
			// Return a default or empty string if not found, but log it
			log.Printf("GetPlatformWalletAddress: Setting not found for key: %s, returning empty", settingKey)
			walletAddress = ""
		} else {
			log.Printf("GetPlatformWalletAddress: Failed to fetch setting: %v", err)
			respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch wallet address")
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"address":  walletAddress,
		"network":  "TRC20",
		"currency": "USDT",
	})
}
