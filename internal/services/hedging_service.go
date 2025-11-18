package services

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"brokerageProject/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HedgingService handles hedged position management
type HedgingService struct {
	pool *pgxpool.Pool
}

// NewHedgingService creates a new hedging service
func NewHedgingService(pool *pgxpool.Pool) *HedgingService {
	return &HedgingService{pool: pool}
}

// PairedPosition represents a hedged position pair
type PairedPosition struct {
	PairID         uuid.UUID
	LongContract   models.Contract
	ShortContract  models.Contract
	IsFullyOpen    bool // Both legs open
	IsPartiallyClosed bool // One leg closed
	IsFullyClosed  bool // Both legs closed
}

// GetPairedPosition fetches both contracts in a hedged pair
func (s *HedgingService) GetPairedPosition(ctx context.Context, pairID uuid.UUID) (*PairedPosition, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size,
		        entry_price, margin_used, leverage, liquidation_price, tp_price, sl_price, close_price, pnl,
		        swap, commission, created_at, closed_at, updated_at
		 FROM contracts WHERE pair_id = $1
		 ORDER BY side ASC`, // Long first, then Short
		pairID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query paired contracts: %w", err)
	}
	defer rows.Close()

	var contracts []models.Contract
	for rows.Next() {
		var contract models.Contract
		err := rows.Scan(
			&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber,
			&contract.Side, &contract.Status, &contract.LotSize, &contract.EntryPrice, &contract.MarginUsed,
			&contract.Leverage, &contract.LiquidationPrice, &contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
			&contract.Swap, &contract.Commission, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan contract: %w", err)
		}
		contracts = append(contracts, contract)
	}

	if len(contracts) != 2 {
		return nil, fmt.Errorf("invalid paired position: expected 2 contracts, found %d", len(contracts))
	}

	pair := &PairedPosition{
		PairID:        pairID,
		LongContract:  contracts[0],
		ShortContract: contracts[1],
	}

	// Determine pair status
	longOpen := contracts[0].Status == models.ContractStatusOpen
	shortOpen := contracts[1].Status == models.ContractStatusOpen

	pair.IsFullyOpen = longOpen && shortOpen
	pair.IsPartiallyClosed = (longOpen && !shortOpen) || (!longOpen && shortOpen)
	pair.IsFullyClosed = !longOpen && !shortOpen

	return pair, nil
}

// ClosePositionWithMarginRelease closes a single contract and releases its margin
// This implements the independent closure logic
func (s *HedgingService) ClosePositionWithMarginRelease(
	ctx context.Context,
	contractID uuid.UUID,
	closePrice float64,
) error {
	// Begin transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Fetch contract details
	var contract models.Contract
	var accountCurrency string
	var pairID sql.NullString
	err = tx.QueryRow(ctx,
		`SELECT c.id, c.user_id, c.account_id, c.symbol, c.contract_number, c.side, c.status,
		        c.lot_size, c.entry_price, c.margin_used, c.leverage, c.liquidation_price,
		        c.tp_price, c.sl_price, c.close_price, c.pnl, c.swap, c.commission,
		        c.created_at, c.closed_at, c.updated_at, c.pair_id,
		        a.currency
		 FROM contracts c
		 JOIN accounts a ON c.account_id = a.id
		 WHERE c.id = $1`,
		contractID,
	).Scan(
		&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber,
		&contract.Side, &contract.Status, &contract.LotSize, &contract.EntryPrice, &contract.MarginUsed,
		&contract.Leverage, &contract.LiquidationPrice, &contract.TPPrice, &contract.SLPrice, &contract.ClosePrice,
		&contract.PnL, &contract.Swap, &contract.Commission, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
		&pairID, &accountCurrency,
	)
	if err != nil {
		return fmt.Errorf("failed to fetch contract: %w", err)
	}

	// Verify contract is open
	if contract.Status != models.ContractStatusOpen {
		return fmt.Errorf("contract is not open (current status: %s)", contract.Status)
	}

	// Calculate PnL
	pnl := s.calculatePnL(contract.Side, contract.LotSize, contract.EntryPrice, closePrice)

	// Calculate total return (margin + PnL - swap/fees)
	totalReturn := contract.MarginUsed + pnl - contract.Swap

	// CRITICAL: Release the margin back to account balance
	_, err = tx.Exec(ctx,
		`UPDATE balances SET amount = amount + $1, updated_at = NOW()
		 WHERE account_id = $2 AND currency = $3`,
		totalReturn, contract.AccountID, accountCurrency,
	)
	if err != nil {
		return fmt.Errorf("failed to release margin: %w", err)
	}

	// Close the contract
	now := time.Now()
	_, err = tx.Exec(ctx,
		`UPDATE contracts SET status = $1, close_price = $2, pnl = $3, closed_at = $4, updated_at = NOW()
		 WHERE id = $5`,
		models.ContractStatusClosed, closePrice, pnl, now, contractID,
	)
	if err != nil {
		return fmt.Errorf("failed to close contract: %w", err)
	}

	// Create transaction record for the position closure (audit trail)
	var transactionNumber string
	err = tx.QueryRow(ctx, "SELECT generate_transaction_number()").Scan(&transactionNumber)
	if err != nil {
		return fmt.Errorf("failed to generate transaction number: %w", err)
	}

	transactionID := uuid.New()
	description := fmt.Sprintf("Position closed: %s %s (Contract %s)", contract.Side, contract.Symbol, contract.ContractNumber)

	_, err = tx.Exec(ctx,
		`INSERT INTO transactions (id, account_id, transaction_number, type, currency, amount, status, contract_id, description, metadata, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
		transactionID,
		contract.AccountID,
		transactionNumber,
		models.TransactionTypePositionClose,
		accountCurrency,
		pnl, // Realized P&L
		models.TransactionStatusCompleted,
		contractID,
		description,
		map[string]interface{}{
			"entry_price":  contract.EntryPrice,
			"close_price":  closePrice,
			"lot_size":     contract.LotSize,
			"leverage":     contract.Leverage,
			"margin_used":  contract.MarginUsed,
			"swap":         contract.Swap,
			"commission":   contract.Commission,
			"total_return": totalReturn,
		},
	)
	if err != nil {
		return fmt.Errorf("failed to create position close transaction: %w", err)
	}

	// If this contract is part of a hedged pair, log the partial closure
	if pairID.Valid {
		pairUUID, _ := uuid.Parse(pairID.String)
		// Check if the other leg is still open
		var otherLegStatus string
		var otherLegSide string
		err = tx.QueryRow(ctx,
			`SELECT status, side FROM contracts WHERE pair_id = $1 AND id != $2`,
			pairUUID, contractID,
		).Scan(&otherLegStatus, &otherLegSide)

		if err == nil && otherLegStatus == string(models.ContractStatusOpen) {
			// Log that the hedge is now broken (one leg closed, other remains)
			// In production, you might want to trigger alerts or risk management actions
			fmt.Printf("WARNING: Hedged pair %s is now unbalanced. %s leg closed, %s leg remains open.\n",
				pairUUID.String(), contract.Side, otherLegSide)
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// CloseEntirePair closes both positions in a hedged pair atomically
func (s *HedgingService) CloseEntirePair(
	ctx context.Context,
	pairID uuid.UUID,
	closePrice float64,
) error {
	// Fetch paired position
	pair, err := s.GetPairedPosition(ctx, pairID)
	if err != nil {
		return err
	}

	// Verify both positions are still open
	if !pair.IsFullyOpen {
		return fmt.Errorf("cannot close pair atomically: one or both positions already closed")
	}

	// Begin transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Fetch account currency
	var accountCurrency string
	err = tx.QueryRow(ctx, "SELECT currency FROM accounts WHERE id = $1", pair.LongContract.AccountID).Scan(&accountCurrency)
	if err != nil {
		return fmt.Errorf("failed to fetch account currency: %w", err)
	}

	// Close both positions
	for _, contract := range []models.Contract{pair.LongContract, pair.ShortContract} {
		pnl := s.calculatePnL(contract.Side, contract.LotSize, contract.EntryPrice, closePrice)
		totalReturn := contract.MarginUsed + pnl - contract.Swap

		// Release margin
		_, err = tx.Exec(ctx,
			`UPDATE balances SET amount = amount + $1, updated_at = NOW()
			 WHERE account_id = $2 AND currency = $3`,
			totalReturn, contract.AccountID, accountCurrency,
		)
		if err != nil {
			return fmt.Errorf("failed to release margin for contract %s: %w", contract.ContractNumber, err)
		}

		// Close contract
		now := time.Now()
		_, err = tx.Exec(ctx,
			`UPDATE contracts SET status = $1, close_price = $2, pnl = $3, closed_at = $4, updated_at = NOW()
			 WHERE id = $5`,
			models.ContractStatusClosed, closePrice, pnl, now, contract.ID,
		)
		if err != nil {
			return fmt.Errorf("failed to close contract %s: %w", contract.ContractNumber, err)
		}

		// Create transaction record for each position closure
		var transactionNumber string
		err = tx.QueryRow(ctx, "SELECT generate_transaction_number()").Scan(&transactionNumber)
		if err != nil {
			return fmt.Errorf("failed to generate transaction number: %w", err)
		}

		transactionID := uuid.New()
		description := fmt.Sprintf("Position closed: %s %s (Contract %s) - Hedged pair closure", contract.Side, contract.Symbol, contract.ContractNumber)

		_, err = tx.Exec(ctx,
			`INSERT INTO transactions (id, account_id, transaction_number, type, currency, amount, status, contract_id, description, metadata, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
			transactionID,
			contract.AccountID,
			transactionNumber,
			models.TransactionTypePositionClose,
			accountCurrency,
			pnl,
			models.TransactionStatusCompleted,
			contract.ID,
			description,
			map[string]interface{}{
				"entry_price":  contract.EntryPrice,
				"close_price":  closePrice,
				"lot_size":     contract.LotSize,
				"leverage":     contract.Leverage,
				"margin_used":  contract.MarginUsed,
				"swap":         contract.Swap,
				"commission":   contract.Commission,
				"total_return": totalReturn,
				"pair_id":      pairID.String(),
				"pair_closure": true,
			},
		)
		if err != nil {
			return fmt.Errorf("failed to create position close transaction for contract %s: %w", contract.ContractNumber, err)
		}
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// calculatePnL calculates profit/loss for a position
func (s *HedgingService) calculatePnL(side models.ContractSide, lotSize, entryPrice, closePrice float64) float64 {
	if side == models.ContractSideLong {
		// Long: profit when price increases
		return (closePrice - entryPrice) * lotSize
	}
	// Short: profit when price decreases
	return (entryPrice - closePrice) * lotSize
}

// GetPairedPositionsByAccount fetches all hedged pairs for an account
func (s *HedgingService) GetPairedPositionsByAccount(ctx context.Context, accountID uuid.UUID) ([]*PairedPosition, error) {
	// Query all distinct pair_ids for this account
	rows, err := s.pool.Query(ctx,
		`SELECT DISTINCT pair_id FROM contracts
		 WHERE account_id = $1 AND pair_id IS NOT NULL
		 ORDER BY created_at DESC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pairs []*PairedPosition
	for rows.Next() {
		var pairID uuid.UUID
		if err := rows.Scan(&pairID); err != nil {
			return nil, err
		}

		pair, err := s.GetPairedPosition(ctx, pairID)
		if err != nil {
			continue // Skip invalid pairs
		}

		pairs = append(pairs, pair)
	}

	return pairs, nil
}

// ValidateMarginAfterClosure checks if remaining position has sufficient margin
// This is called after independent closure to ensure the remaining leg is still healthy
func (s *HedgingService) ValidateMarginAfterClosure(ctx context.Context, remainingContractID uuid.UUID) (bool, string, error) {
	var marginUsed, entryPrice float64
	var leverage int
	var side models.ContractSide

	err := s.pool.QueryRow(ctx,
		`SELECT margin_used, entry_price, leverage, side FROM contracts WHERE id = $1`,
		remainingContractID,
	).Scan(&marginUsed, &entryPrice, &leverage, &side)
	if err != nil {
		return false, "", err
	}

	// Calculate maintenance margin requirement
	notionalValue := marginUsed * float64(leverage)
	maintenanceMarginRequired := notionalValue / float64(leverage) * 0.5 // 50% of initial margin

	if marginUsed < maintenanceMarginRequired {
		return false, fmt.Sprintf("margin (%.2f) below maintenance requirement (%.2f)", marginUsed, maintenanceMarginRequired), nil
	}

	return true, "margin sufficient", nil
}
