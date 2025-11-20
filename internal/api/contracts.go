package api

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/hub"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"
	"brokerageProject/internal/services"

	"github.com/google/uuid"
)

// CreateContract handles POST /api/v1/contracts
// Opens a new position/contract
func CreateContract(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	var req models.CreateContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	// Validate
	if req.LotSize <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "lot_size must be positive")
		return
	}
	if req.EntryPrice <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "entry_price must be positive")
		return
	}
	if req.Leverage <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "leverage must be positive")
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
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", req.AccountID).Scan(&accountUserID)
	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "account not found")
		return
	}
	if accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Verify instrument and check leverage cap
	var isTradeable bool
	var instrumentType string
	err = pool.QueryRow(ctx,
		"SELECT is_tradable, instrument_type FROM instruments WHERE symbol = $1",
		req.Symbol,
	).Scan(&isTradeable, &instrumentType)

	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "instrument not found")
		return
	}
	if !isTradeable {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "instrument is not tradeable")
		return
	}

	// Get max leverage from the appropriate configuration table
	var maxLeverage int
	if instrumentType == "forex" {
		// Query forex_configurations for max_leverage
		err = pool.QueryRow(ctx,
			"SELECT max_leverage FROM forex_configurations WHERE symbol = $1",
			req.Symbol,
		).Scan(&maxLeverage)
		if err != nil {
			respondWithJSONError(w, http.StatusNotFound, "not_found", "forex configuration not found for this instrument")
			return
		}
	} else {
		// For crypto/spot instruments, default max leverage is typically 1-10x
		// Since spot_configurations doesn't have leverage, we'll set a default
		maxLeverage = 10 // Default max leverage for spot trading
	}

	if req.Leverage > maxLeverage {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", fmt.Sprintf("leverage exceeds maximum of %dx for this instrument", maxLeverage))
		return
	}

	// Calculate margin required
	marginUsed := (req.LotSize * req.EntryPrice) / float64(req.Leverage)

	// TODO: Check account has sufficient margin (implement balance check)

	// Generate contract number
	var contractNumber string
	err = pool.QueryRow(ctx, "SELECT generate_contract_number()").Scan(&contractNumber)
	if err != nil {
		log.Printf("Failed to generate contract number: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "generation_error", "failed to generate contract number")
		return
	}

	// Create contract
	contractID := uuid.New()
	_, err = pool.Exec(ctx,
		`INSERT INTO contracts (id, user_id, account_id, symbol, contract_number, side, status, lot_size, entry_price, margin_used, leverage, tp_price, sl_price, swap, commission, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, NOW(), NOW())`,
		contractID, userID, req.AccountID, req.Symbol, contractNumber, req.Side, models.ContractStatusOpen,
		req.LotSize, req.EntryPrice, marginUsed, req.Leverage, req.TPPrice, req.SLPrice,
	)
	if err != nil {
		log.Printf("Failed to insert contract: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to create contract")
		return
	}

	// Fetch created contract
	var contract models.Contract
	err = pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size, entry_price, margin_used, leverage,
		        tp_price, sl_price, close_price, pnl, swap, commission, pair_id, created_at, closed_at, updated_at
		 FROM contracts WHERE id = $1`,
		contractID,
	).Scan(
		&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber, &contract.Side, &contract.Status,
		&contract.LotSize, &contract.EntryPrice, &contract.MarginUsed, &contract.Leverage,
		&contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
		&contract.Swap, &contract.Commission, &contract.PairID, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
	)
	if err != nil {
		log.Printf("Failed to fetch contract: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "contract created but failed to fetch")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"contract": contract,
	})
}

// GetContracts handles GET /api/v1/contracts
// Returns contracts for a specific account (can filter by status)
func GetContracts(w http.ResponseWriter, r *http.Request) {
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

	statusFilter := r.URL.Query().Get("status") // optional: "open", "closed", "liquidated"

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

	// Build query based on status filter
	query := `SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size, entry_price, margin_used, leverage,
	                 tp_price, sl_price, close_price, pnl, swap, commission, pair_id, created_at, closed_at, updated_at
	          FROM contracts
	          WHERE account_id = $1`

	args := []interface{}{accountID}

	if statusFilter != "" {
		query += " AND status = $2"
		args = append(args, statusFilter)
	}

	query += " ORDER BY created_at DESC LIMIT 100"

	// Fetch contracts
	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		log.Printf("Failed to query contracts: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch contracts")
		return
	}
	defer rows.Close()

	// Get price cache for real-time unrealized PnL calculation
	priceCache := services.GetGlobalPriceCache()

	var contracts []models.Contract
	for rows.Next() {
		var contract models.Contract
		err := rows.Scan(
			&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber, &contract.Side, &contract.Status,
			&contract.LotSize, &contract.EntryPrice, &contract.MarginUsed, &contract.Leverage,
			&contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
			&contract.Swap, &contract.Commission, &contract.PairID, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan contract: %v", err)
			continue
		}

		// Calculate real-time unrealized PnL for open positions
		if contract.Status == models.ContractStatusOpen && priceCache != nil {
			currentPrice, err := priceCache.GetPrice(contract.Symbol)
			if err == nil && currentPrice > 0 {
				var unrealizedPnL float64
				switch contract.Side {
				case models.ContractSideLong:
					// Long position: profit when price goes up
					unrealizedPnL = (currentPrice - contract.EntryPrice) * contract.LotSize
				case models.ContractSideShort:
					// Short position: profit when price goes down
					unrealizedPnL = (contract.EntryPrice - currentPrice) * contract.LotSize
				}
				contract.UnrealizedPnL = &unrealizedPnL
			}
		}

		contracts = append(contracts, contract)
	}

	if contracts == nil {
		contracts = []models.Contract{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"contracts": contracts,
	})
}

// GetContractHistory handles GET /api/v1/contracts/history
// Returns closed and liquidated contracts for an account
func GetContractHistory(w http.ResponseWriter, r *http.Request) {
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

	// Query closed and liquidated contracts
	query := `SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size, entry_price, margin_used, leverage,
	                 tp_price, sl_price, close_price, pnl, swap, commission, pair_id, created_at, closed_at, updated_at
	          FROM contracts
	          WHERE account_id = $1 AND status IN ('closed', 'liquidated')
	          ORDER BY closed_at DESC NULLS LAST, created_at DESC
	          LIMIT 200`

	rows, err := pool.Query(ctx, query, accountID)
	if err != nil {
		log.Printf("Failed to query contract history: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to fetch contract history")
		return
	}
	defer rows.Close()

	var contracts []models.Contract
	for rows.Next() {
		var contract models.Contract
		err := rows.Scan(
			&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber,
			&contract.Side, &contract.Status, &contract.LotSize, &contract.EntryPrice, &contract.MarginUsed,
			&contract.Leverage, &contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
			&contract.Swap, &contract.Commission, &contract.PairID, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan contract: %v", err)
			continue
		}

		contracts = append(contracts, contract)
	}

	if contracts == nil {
		contracts = []models.Contract{}
	}

	// Calculate total realized P&L
	var totalPnL float64
	for _, contract := range contracts {
		if contract.PnL != nil {
			totalPnL += *contract.PnL
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"contracts": contracts,
		"total_pnl": totalPnL,
		"count":     len(contracts),
	})
}

// CloseContract handles POST /api/v1/contracts/{contract_id}/close
// Closes an open contract with margin release (supports independent closure of hedged positions)
func CloseContract(h *hub.Hub, w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	contractIDStr := r.URL.Query().Get("contract_id")
	if contractIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "contract_id parameter is required")
		return
	}

	contractID, err := uuid.Parse(contractIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid contract_id format")
		return
	}

	var req models.CloseContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	if req.ClosePrice <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "close_price must be positive")
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

	// Verify contract belongs to user and is open
	var contractUserID int64
	var contractStatus models.ContractStatus

	err = pool.QueryRow(ctx,
		`SELECT a.user_id, c.status
		 FROM contracts c
		 JOIN accounts a ON c.account_id = a.id
		 WHERE c.id = $1`,
		contractID,
	).Scan(&contractUserID, &contractStatus)

	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "contract not found")
		return
	}
	if contractUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "contract does not belong to user")
		return
	}
	if contractStatus != models.ContractStatusOpen {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_state", "only open contracts can be closed")
		return
	}

	// Use HedgingService for closure with margin release
	hedgingService := services.NewHedgingService(pool)
	err = hedgingService.ClosePositionWithMarginRelease(ctx, contractID, req.ClosePrice)
	if err != nil {
		log.Printf("Failed to close contract with margin release: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "execution_error", fmt.Sprintf("failed to close contract: %v", err))
		return
	}

	// Fetch closed contract to return details
	var contract models.Contract
	err = pool.QueryRow(ctx,
		`SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size, entry_price, margin_used, leverage,
		        tp_price, sl_price, close_price, pnl, swap, commission, pair_id, created_at, closed_at, updated_at
		 FROM contracts WHERE id = $1`,
		contractID,
	).Scan(
		&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber, &contract.Side, &contract.Status,
		&contract.LotSize, &contract.EntryPrice, &contract.MarginUsed, &contract.Leverage,
		&contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
		&contract.Swap, &contract.Commission, &contract.PairID, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
	)
	if err != nil {
		log.Printf("Failed to fetch closed contract: %v", err)
		// Contract was closed successfully, just couldn't fetch details
	}

	// Broadcast position closed event to all connected WebSocket clients
	if h != nil {
		positionUpdate := map[string]interface{}{
			"type":       "position_closed",
			"contract":   contract,
			"account_id": contract.AccountID.String(),
		}
		if updateBytes, err := json.Marshal(positionUpdate); err == nil {
			h.BroadcastMessage(updateBytes)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "contract closed successfully with margin released",
		"contract": contract,
	})
}

// ClosePair handles POST /api/v1/contracts/close-pair
// Closes both positions in a hedged pair atomically
func ClosePair(h *hub.Hub, w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	pairIDStr := r.URL.Query().Get("pair_id")
	if pairIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "pair_id parameter is required")
		return
	}

	pairID, err := uuid.Parse(pairIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid pair_id format")
		return
	}

	var req models.CloseContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	if req.ClosePrice <= 0 {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "close_price must be positive")
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

	// Verify both contracts in the pair belong to user and are open
	var longContractID uuid.UUID
	var shortContractID uuid.UUID
	var longStatus models.ContractStatus
	var shortStatus models.ContractStatus
	var accountID uuid.UUID
	var accountUserID int64

	// Get long contract and verify ownership via account
	err = pool.QueryRow(ctx,
		`SELECT c.id, c.status, c.account_id, a.user_id
		 FROM contracts c
		 JOIN accounts a ON c.account_id = a.id
		 WHERE c.pair_id = $1 AND c.side = 'long'`,
		pairID,
	).Scan(&longContractID, &longStatus, &accountID, &accountUserID)

	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "long contract in pair not found")
		return
	}

	// Get short contract
	var shortAccountUserID int64
	err = pool.QueryRow(ctx,
		`SELECT c.id, c.status, a.user_id
		 FROM contracts c
		 JOIN accounts a ON c.account_id = a.id
		 WHERE c.pair_id = $1 AND c.side = 'short'`,
		pairID,
	).Scan(&shortContractID, &shortStatus, &shortAccountUserID)

	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "short contract in pair not found")
		return
	}

	// Verify ownership and status
	if accountUserID != userID || shortAccountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "pair does not belong to user")
		return
	}
	if longStatus != models.ContractStatusOpen || shortStatus != models.ContractStatusOpen {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_state", "both contracts in pair must be open")
		return
	}

	// Use HedgingService to close entire pair atomically
	hedgingService := services.NewHedgingService(pool)
	err = hedgingService.CloseEntirePair(ctx, pairID, req.ClosePrice)
	if err != nil {
		log.Printf("Failed to close pair: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "execution_error", fmt.Sprintf("failed to close pair: %v", err))
		return
	}

	// Fetch both closed contracts to return details
	query := `SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size, entry_price, margin_used, leverage,
	                 tp_price, sl_price, close_price, pnl, swap, commission, pair_id, created_at, closed_at, updated_at
	          FROM contracts WHERE pair_id = $1`

	rows, err := pool.Query(ctx, query, pairID)
	if err != nil {
		log.Printf("Failed to fetch closed pair contracts: %v", err)
		// Pair was closed successfully, just couldn't fetch details
	}
	defer rows.Close()

	var contracts []models.Contract
	for rows.Next() {
		var contract models.Contract
		err := rows.Scan(
			&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber, &contract.Side, &contract.Status,
			&contract.LotSize, &contract.EntryPrice, &contract.MarginUsed, &contract.Leverage,
			&contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
			&contract.Swap, &contract.Commission, &contract.PairID, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
		)
		if err != nil {
			log.Printf("Failed to scan contract: %v", err)
			continue
		}
		contracts = append(contracts, contract)
	}

	// Broadcast pair closed event to all connected WebSocket clients
	if h != nil {
		pairUpdate := map[string]interface{}{
			"type":       "pair_closed",
			"contracts":  contracts,
			"pair_id":    pairID.String(),
			"account_id": accountID.String(),
		}
		if updateBytes, err := json.Marshal(pairUpdate); err == nil {
			h.BroadcastMessage(updateBytes)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   "hedged pair closed successfully",
		"contracts": contracts,
		"pair_id":   pairID.String(),
	})
}

// UpdateContractTPSL handles PATCH /api/v1/contracts/{contract_id}/tpsl
// Updates take profit and stop loss for an open contract
func UpdateContractTPSL(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r.Context())
	if err != nil {
		respondWithJSONError(w, http.StatusUnauthorized, "unauthorized", "user not authenticated")
		return
	}

	contractIDStr := r.URL.Query().Get("contract_id")
	if contractIDStr == "" {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "contract_id parameter is required")
		return
	}

	contractID, err := uuid.Parse(contractIDStr)
	if err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid contract_id format")
		return
	}

	var req models.UpdateContractTPSLRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_request", "invalid request body")
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

	// Verify contract belongs to user and is open
	var contractUserID int64
	var contractStatus models.ContractStatus

	err = pool.QueryRow(ctx,
		`SELECT a.user_id, c.status
		 FROM contracts c
		 JOIN accounts a ON c.account_id = a.id
		 WHERE c.id = $1`,
		contractID,
	).Scan(&contractUserID, &contractStatus)

	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "contract not found")
		return
	}
	if contractUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "contract does not belong to user")
		return
	}
	if contractStatus != models.ContractStatusOpen {
		respondWithJSONError(w, http.StatusBadRequest, "invalid_state", "only open contracts can be updated")
		return
	}

	// Update TP/SL
	_, err = pool.Exec(ctx,
		`UPDATE contracts
		 SET tp_price = $1, sl_price = $2, updated_at = NOW()
		 WHERE id = $3`,
		req.TPPrice, req.SLPrice, contractID,
	)
	if err != nil {
		log.Printf("Failed to update contract TP/SL: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to update contract")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "TP/SL updated successfully",
	})
}
