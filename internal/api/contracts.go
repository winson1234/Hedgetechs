package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"

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
	var accountUserID uuid.UUID
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
	var leverageCap int
	err = pool.QueryRow(ctx,
		"SELECT is_tradeable, leverage_cap FROM instruments WHERE symbol = $1",
		req.Symbol,
	).Scan(&isTradeable, &leverageCap)

	if err != nil {
		respondWithJSONError(w, http.StatusNotFound, "not_found", "instrument not found")
		return
	}
	if !isTradeable {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "instrument is not tradeable")
		return
	}
	if req.Leverage > leverageCap {
		respondWithJSONError(w, http.StatusBadRequest, "validation_error", "leverage exceeds cap for this instrument")
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
		        tp_price, sl_price, close_price, pnl, swap, commission, created_at, closed_at, updated_at
		 FROM contracts WHERE id = $1`,
		contractID,
	).Scan(
		&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber, &contract.Side, &contract.Status,
		&contract.LotSize, &contract.EntryPrice, &contract.MarginUsed, &contract.Leverage,
		&contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
		&contract.Swap, &contract.Commission, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
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
	var accountUserID uuid.UUID
	err = pool.QueryRow(ctx, "SELECT user_id FROM accounts WHERE id = $1", accountID).Scan(&accountUserID)
	if err != nil || accountUserID != userID {
		respondWithJSONError(w, http.StatusForbidden, "forbidden", "account does not belong to user")
		return
	}

	// Build query based on status filter
	query := `SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size, entry_price, margin_used, leverage,
	                 tp_price, sl_price, close_price, pnl, swap, commission, created_at, closed_at, updated_at
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

	var contracts []models.Contract
	for rows.Next() {
		var contract models.Contract
		err := rows.Scan(
			&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber, &contract.Side, &contract.Status,
			&contract.LotSize, &contract.EntryPrice, &contract.MarginUsed, &contract.Leverage,
			&contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
			&contract.Swap, &contract.Commission, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"contracts": contracts,
	})
}

// CloseContract handles POST /api/v1/contracts/{contract_id}/close
// Closes an open contract
func CloseContract(w http.ResponseWriter, r *http.Request) {
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
	var contractUserID uuid.UUID
	var contractStatus models.ContractStatus
	var side models.ContractSide
	var lotSize, entryPrice, swap, commission float64

	err = pool.QueryRow(ctx,
		"SELECT user_id, status, side, lot_size, entry_price, swap, commission FROM contracts WHERE id = $1",
		contractID,
	).Scan(&contractUserID, &contractStatus, &side, &lotSize, &entryPrice, &swap, &commission)

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

	// Calculate PnL
	var pnl float64
	if side == models.ContractSideLong {
		pnl = (req.ClosePrice - entryPrice) * lotSize
	} else {
		pnl = (entryPrice - req.ClosePrice) * lotSize
	}

	// Deduct swap and commission
	pnl = pnl - swap - commission

	// Update contract
	now := time.Now()
	_, err = pool.Exec(ctx,
		`UPDATE contracts
		 SET status = $1, close_price = $2, pnl = $3, closed_at = $4, updated_at = NOW()
		 WHERE id = $5`,
		models.ContractStatusClosed, req.ClosePrice, pnl, now, contractID,
	)
	if err != nil {
		log.Printf("Failed to close contract: %v", err)
		respondWithJSONError(w, http.StatusInternalServerError, "database_error", "failed to close contract")
		return
	}

	// TODO: Update account balance with PnL

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "contract closed successfully",
		"pnl":     pnl,
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
	var contractUserID uuid.UUID
	var contractStatus models.ContractStatus

	err = pool.QueryRow(ctx,
		"SELECT user_id, status FROM contracts WHERE id = $1",
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
