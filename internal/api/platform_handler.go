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
// Returns the platform's USDT wallet address based on network query param
// Default: TRC20
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

	// Get network from query param, default to TRC-20
	network := r.URL.Query().Get("network")
	if network == "" {
		network = "TRC-20"
	}

	// Determine setting key based on network
	var settingKey string
	var currency = "USDT"

	switch network {
	case "BEP20", "BEP-20":
		settingKey = "usdt_bep20_wallet_address" // Make sure this key exists in platform_settings or plan to add it?
		// Note: User request implied similar concept to existing. Default behavior if key missing is empty string.
		// Assuming the key "usdt_bep20_wallet_address" is the convention.
		network = "BEP-20"
	case "TRC20", "TRC-20":
		settingKey = "usdt_trc20_wallet_address"
		network = "TRC-20" // Standardize case
	default:
		// Fallback to TRC-20 for unknown networks
		network = "TRC-20"
		settingKey = "usdt_trc20_wallet_address"
	}

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
		"network":  network,
		"currency": currency,
	})
}
