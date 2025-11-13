package services

import (
	"context"
	"fmt"
	"log"
	"brokerageProject/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// LiquidationService handles automatic liquidation of positions when they hit liquidation price
type LiquidationService struct {
	pool *pgxpool.Pool
}

// NewLiquidationService creates a new liquidation service
func NewLiquidationService(pool *pgxpool.Pool) *LiquidationService {
	return &LiquidationService{
		pool: pool,
	}
}

// CheckLiquidations checks if any open positions should be liquidated based on current price
// This function is called IMMEDIATELY after each price update (event-driven)
func (s *LiquidationService) CheckLiquidations(ctx context.Context, symbol string, currentPrice float64) error {
	// Fetch all open contracts for this symbol that have liquidation prices set
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, account_id, symbol, side, lot_size, entry_price, margin_used,
		        leverage, liquidation_price, contract_number
		 FROM contracts
		 WHERE symbol = $1
		   AND status = 'open'
		   AND liquidation_price IS NOT NULL`,
		symbol,
	)
	if err != nil {
		return fmt.Errorf("failed to fetch open contracts: %w", err)
	}
	defer rows.Close()

	var contractsToLiquidate []struct {
		ID               string
		UserID           string
		AccountID        string
		Symbol           string
		Side             models.ContractSide
		LotSize          float64
		EntryPrice       float64
		MarginUsed       float64
		Leverage         int
		LiquidationPrice float64
		ContractNumber   string
	}

	for rows.Next() {
		var contract struct {
			ID               string
			UserID           string
			AccountID        string
			Symbol           string
			Side             models.ContractSide
			LotSize          float64
			EntryPrice       float64
			MarginUsed       float64
			Leverage         int
			LiquidationPrice float64
			ContractNumber   string
		}
		err := rows.Scan(
			&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol,
			&contract.Side, &contract.LotSize, &contract.EntryPrice, &contract.MarginUsed,
			&contract.Leverage, &contract.LiquidationPrice, &contract.ContractNumber,
		)
		if err != nil {
			log.Printf("ERROR: Failed to scan contract row: %v", err)
			continue
		}

		// Check if liquidation price has been crossed
		shouldLiquidate := false
		if contract.Side == models.ContractSideLong {
			// Long position: liquidate if price drops to or below liquidation price
			shouldLiquidate = currentPrice <= contract.LiquidationPrice
		} else {
			// Short position: liquidate if price rises to or above liquidation price
			shouldLiquidate = currentPrice >= contract.LiquidationPrice
		}

		if shouldLiquidate {
			contractsToLiquidate = append(contractsToLiquidate, contract)
		}
	}

	// Liquidate each position
	for _, contract := range contractsToLiquidate {
		err := s.liquidatePosition(ctx, contract.ID, contract.AccountID, contract.Symbol,
			contract.Side, contract.LotSize, contract.EntryPrice, contract.MarginUsed,
			currentPrice, contract.ContractNumber)
		if err != nil {
			log.Printf("ERROR: Failed to liquidate position %s (%s): %v", contract.ID, contract.ContractNumber, err)
		} else {
			log.Printf("LIQUIDATED position %s (%s) for %s at price %.8f (entry: %.8f, leverage: %dx)",
				contract.ID, contract.ContractNumber, contract.Symbol, currentPrice, contract.EntryPrice, contract.Leverage)
		}
	}

	return nil
}

// liquidatePosition closes a position at liquidation price and handles P&L
func (s *LiquidationService) liquidatePosition(
	ctx context.Context,
	contractID, accountID, _ string, // symbol unused
	side models.ContractSide,
	lotSize, entryPrice, marginUsed, liquidationPrice float64,
	_ string, // contractNumber unused
) error {
	// Begin transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Calculate P&L at liquidation price
	var pnl float64
	if side == models.ContractSideLong {
		pnl = (liquidationPrice - entryPrice) * lotSize
	} else {
		pnl = (entryPrice - liquidationPrice) * lotSize
	}

	// Calculate remaining margin (margin lost + what's left)
	remainingMargin := marginUsed + pnl
	if remainingMargin < 0 {
		// Prevent negative balance (broker protection)
		remainingMargin = 0
	}

	// Get account currency
	var accountCurrency string
	err = tx.QueryRow(ctx, "SELECT currency FROM accounts WHERE id = $1", accountID).Scan(&accountCurrency)
	if err != nil {
		return fmt.Errorf("failed to get account currency: %w", err)
	}

	// Return remaining margin to account balance (if any)
	if remainingMargin > 0 {
		_, err = tx.Exec(ctx,
			`UPDATE balances
			 SET amount = amount + $1, updated_at = NOW()
			 WHERE account_id = $2 AND currency = $3`,
			remainingMargin, accountID, accountCurrency,
		)
		if err != nil {
			return fmt.Errorf("failed to return margin: %w", err)
		}
	}

	// Update contract status to liquidated
	_, err = tx.Exec(ctx,
		`UPDATE contracts
		 SET status = 'liquidated',
		     close_price = $1,
		     pnl = $2,
		     closed_at = NOW(),
		     updated_at = NOW()
		 WHERE id = $3`,
		liquidationPrice, pnl, contractID,
	)
	if err != nil {
		return fmt.Errorf("failed to update contract: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
