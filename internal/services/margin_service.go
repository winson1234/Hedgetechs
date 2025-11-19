package services

import (
	"context"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MarginMetrics represents calculated margin data for an account
type MarginMetrics struct {
	TotalBalance  float64 `json:"total_balance"`
	UsedMargin    float64 `json:"used_margin"`
	UnrealizedPnL float64 `json:"unrealized_pnl"`
	Equity        float64 `json:"equity"`
	FreeMargin    float64 `json:"free_margin"`
	MarginLevel   float64 `json:"margin_level"`
}

// MarginService handles margin calculations for accounts
type MarginService struct {
	pool *pgxpool.Pool
}

var (
	globalMarginService     *MarginService
	globalMarginServiceOnce sync.Once
)

// GetGlobalMarginService returns the singleton MarginService instance
func GetGlobalMarginService() *MarginService {
	globalMarginServiceOnce.Do(func() {
		globalMarginService = &MarginService{}
	})
	return globalMarginService
}

// InitMarginService initializes the MarginService with a database pool
func (ms *MarginService) InitMarginService(pool *pgxpool.Pool) {
	ms.pool = pool
}

// CalculateMargin calculates real-time margin metrics for an account
func (ms *MarginService) CalculateMargin(accountID uuid.UUID) (*MarginMetrics, error) {
	ctx := context.Background()

	if ms.pool == nil {
		return nil, fmt.Errorf("margin service not initialized")
	}

	metrics := &MarginMetrics{}

	// 1. Fetch cash balance from balances table (USD/USDT)
	var totalBalance float64
	err := ms.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount), 0)
		 FROM balances
		 WHERE account_id = $1 AND currency IN ('USD', 'USDT')`,
		accountID,
	).Scan(&totalBalance)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch balance: %w", err)
	}
	metrics.TotalBalance = totalBalance

	// 2. Fetch all open contracts
	rows, err := ms.pool.Query(ctx,
		`SELECT id, symbol, side, lot_size, entry_price, margin_used
		 FROM contracts
		 WHERE account_id = $1 AND status = 'open'`,
		accountID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch open contracts: %w", err)
	}
	defer rows.Close()

	// 3. Calculate used margin and unrealized PnL
	var totalUsedMargin float64
	var totalUnrealizedPnL float64

	priceCache := GetGlobalPriceCache()

	for rows.Next() {
		var contractID uuid.UUID
		var symbol string
		var side string
		var lotSize float64
		var entryPrice float64
		var marginUsed float64

		if err := rows.Scan(&contractID, &symbol, &side, &lotSize, &entryPrice, &marginUsed); err != nil {
			return nil, fmt.Errorf("failed to scan contract: %w", err)
		}

		// Sum margin used
		totalUsedMargin += marginUsed

		// Get current market price from cache
		currentPrice, err := priceCache.GetPrice(symbol)
		if err == nil && currentPrice > 0 {
			// Calculate unrealized PnL
			// Long position: (currentPrice - entryPrice) * lotSize
			// Short position: (entryPrice - currentPrice) * lotSize
			var pnl float64
			switch side {
			case "long":
				pnl = (currentPrice - entryPrice) * lotSize
			case "short":
				pnl = (entryPrice - currentPrice) * lotSize
			}
			totalUnrealizedPnL += pnl
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating contracts: %w", err)
	}

	metrics.UsedMargin = totalUsedMargin
	metrics.UnrealizedPnL = totalUnrealizedPnL

	// 4. Calculate Equity = TotalBalance + UnrealizedPnL
	metrics.Equity = totalBalance + totalUnrealizedPnL

	// 5. Calculate FreeMargin = Equity - UsedMargin
	metrics.FreeMargin = metrics.Equity - totalUsedMargin

	// 6. Calculate MarginLevel = (Equity / UsedMargin) * 100
	if totalUsedMargin > 0 {
		metrics.MarginLevel = (metrics.Equity / totalUsedMargin) * 100
	} else {
		// No open positions, margin level is effectively infinite
		metrics.MarginLevel = 0
	}

	return metrics, nil
}
