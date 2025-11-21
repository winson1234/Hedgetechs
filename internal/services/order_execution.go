package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"brokerageProject/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// OrderExecutionService handles order execution logic
type OrderExecutionService struct {
	pool *pgxpool.Pool
}

// NewOrderExecutionService creates a new order execution service
func NewOrderExecutionService(pool *pgxpool.Pool) *OrderExecutionService {
	return &OrderExecutionService{pool: pool}
}

// ExecutionResult contains the result of order execution
type ExecutionResult struct {
	Order       models.Order
	Transaction *models.Transaction
	Contract    *models.Contract
	Success     bool
	Message     string
}

// ExecuteOrder executes a trading order (market or limit orders that can be filled immediately)
func (s *OrderExecutionService) ExecuteOrder(ctx context.Context, orderID uuid.UUID, executionPrice float64) (*ExecutionResult, error) {
	// Begin transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Fetch order details (product_type now comes from orders table)
	// PERFORMANCE: Use SELECT FOR UPDATE to lock row and prevent race conditions
	var order models.Order
	var accountCurrency, quoteCurrency string
	err = tx.QueryRow(ctx,
		`SELECT o.id, o.user_id, o.account_id, o.symbol, o.order_number, o.side, o.type,
		        o.status, o.amount_base, o.limit_price, o.stop_price, o.leverage, o.product_type, o.filled_amount,
		        o.average_fill_price, o.created_at, o.updated_at,
		        a.currency,
		        i.quote_currency
		 FROM orders o
		 JOIN accounts a ON o.account_id = a.id
		 JOIN instruments i ON o.symbol = i.symbol
		 WHERE o.id = $1
		 FOR UPDATE OF o NOWAIT`,
		orderID,
	).Scan(
		&order.ID, &order.UserID, &order.AccountID, &order.Symbol, &order.OrderNumber,
		&order.Side, &order.Type, &order.Status, &order.AmountBase, &order.LimitPrice,
		&order.StopPrice, &order.Leverage, &order.ProductType, &order.FilledAmount, &order.AverageFillPrice,
		&order.CreatedAt, &order.UpdatedAt,
		&accountCurrency, &quoteCurrency,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch order: %w", err)
	}

	// Validate order can be executed
	if order.Status != models.OrderStatusPending {
		return &ExecutionResult{
			Order:   order,
			Success: false,
			Message: fmt.Sprintf("order is not pending (current status: %s)", order.Status),
		}, nil
	}

	// Calculate notional value and fees
	notionalValue := order.AmountBase * executionPrice
	feeRate := 0.001 // 0.1% trading fee (standard for exchanges)
	fee := notionalValue * feeRate

	// Check if this is spot or leveraged trading (read from order.ProductType)
	isSpot := order.ProductType == models.ProductTypeSpot

	var result *ExecutionResult
	if isSpot {
		result, err = s.executeSpotOrder(ctx, tx, &order, executionPrice, notionalValue, fee, accountCurrency, quoteCurrency)
	} else {
		// For leveraged products, check if LP routing is enabled before creating service
		// PERFORMANCE FIX: Skip routing service creation if disabled (saves 1-2 seconds)
		var routingEnabled bool
		err := s.pool.QueryRow(ctx, `
			SELECT COALESCE((config_value->>'value')::boolean, false)
			FROM lp_routing_config
			WHERE config_key = 'enabled'
			LIMIT 1
		`).Scan(&routingEnabled)

		// Default to B-Book if query fails or table doesn't exist
		if err != nil && err != pgx.ErrNoRows {
			log.Printf("Failed to check routing config: %v, defaulting to B-Book", err)
		}

		var execErr error
		if routingEnabled {
			// Routing is enabled - create service and make decision
			routingService := NewRoutingService(s.pool)

			var orderSideStr string
			if order.Side == models.OrderSideBuy {
				orderSideStr = "buy"
			} else {
				orderSideStr = "sell"
			}

			routingDecision, decisionErr := routingService.ShouldRouteToLP(
				ctx,
				order.Symbol,
				orderSideStr,
				decimal.NewFromFloat(order.AmountBase),
				decimal.NewFromFloat(executionPrice),
			)
			if decisionErr != nil {
				log.Printf("Routing decision error: %v, defaulting to B-Book", decisionErr)
				result, execErr = s.ExecuteDualPositionOrder(ctx, tx, &order, executionPrice, notionalValue, fee, accountCurrency)
			} else if routingDecision.ShouldRouteToLP {
				// A-Book: Route to external LP
				log.Printf("Routing order %s to LP: %s", order.OrderNumber, routingDecision.Reason)
				result, execErr = s.ExecuteExternalOrder(ctx, tx, &order, routingService.GetConfig().PrimaryLPProvider, notionalValue, fee, accountCurrency)
			} else {
				// B-Book: Execute internally
				log.Printf("Executing order %s internally (B-Book): %s", order.OrderNumber, routingDecision.Reason)
				result, execErr = s.ExecuteDualPositionOrder(ctx, tx, &order, executionPrice, notionalValue, fee, accountCurrency)
			}
		} else {
			// Routing disabled - skip directly to B-Book (dual-position hedging)
			log.Printf("Executing order %s internally (B-Book): LP routing disabled", order.OrderNumber)
			result, execErr = s.ExecuteDualPositionOrder(ctx, tx, &order, executionPrice, notionalValue, fee, accountCurrency)
		}

		if execErr != nil {
			return nil, execErr
		}
	}

	if err != nil {
		return nil, err
	}

	if !result.Success {
		return result, nil
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return result, nil
}

// getEquivalentCurrency returns the equivalent currency for USD/USDT interchangeability
// For trading purposes, USD and USDT are treated as equivalent (1:1 parity)
func getEquivalentCurrency(currency string) string {
	if currency == "USDT" {
		return "USD"
	}
	if currency == "USD" {
		return "USDT"
	}
	return currency
}

// isInsufficientBalanceError checks if an error is an insufficient balance error
func isInsufficientBalanceError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := err.Error()
	return len(errMsg) > 12 && errMsg[:12] == "insufficient"
}

// getBalanceWithFallback checks balance for a currency, with fallback to equivalent currency
// Returns: actualCurrency (the one that exists), balance, error
func (s *OrderExecutionService) getBalanceWithFallback(ctx context.Context, tx pgx.Tx, accountID uuid.UUID, preferredCurrency string) (string, float64, error) {
	// Get equivalent currency (USD <-> USDT)
	equivalentCurrency := getEquivalentCurrency(preferredCurrency)

	// Check if preferred and equivalent are different (USD/USDT case)
	if equivalentCurrency != preferredCurrency {
		// USD and USDT are equivalent - check preferred first, then fallback
		// IMPORTANT: Return the currency that ACTUALLY has enough balance, don't sum them!

		// First try preferred currency
		var preferredBalance float64
		err := tx.QueryRow(ctx,
			`SELECT COALESCE(amount, 0) FROM balances
			 WHERE account_id = $1 AND currency = $2`,
			accountID, preferredCurrency,
		).Scan(&preferredBalance)

		if err != nil && err != pgx.ErrNoRows {
			return "", 0, fmt.Errorf("failed to check %s balance: %w", preferredCurrency, err)
		}

		// If preferred has balance, use it
		if preferredBalance > 0 {
			return preferredCurrency, preferredBalance, nil
		}

		// Try equivalent currency as fallback
		var equivalentBalance float64
		err = tx.QueryRow(ctx,
			`SELECT COALESCE(amount, 0) FROM balances
			 WHERE account_id = $1 AND currency = $2`,
			accountID, equivalentCurrency,
		).Scan(&equivalentBalance)

		if err != nil && err != pgx.ErrNoRows {
			return "", 0, fmt.Errorf("failed to check %s balance: %w", equivalentCurrency, err)
		}

		// Return whichever has more balance (or preferred if both zero)
		if equivalentBalance > preferredBalance {
			return equivalentCurrency, equivalentBalance, nil
		}

		return preferredCurrency, preferredBalance, nil
	}

	// For non-equivalent currencies, just check the single balance
	var balance float64
	err := tx.QueryRow(ctx,
		`SELECT amount FROM balances WHERE account_id = $1 AND currency = $2`,
		accountID, preferredCurrency,
	).Scan(&balance)

	if err == pgx.ErrNoRows {
		return preferredCurrency, 0, nil
	}

	if err != nil {
		return "", 0, fmt.Errorf("failed to check balance: %w", err)
	}

	return preferredCurrency, balance, nil
}

// ExecuteSpotTrade executes spot trading logic (balance updates only)
// This is a shared method used by both market orders and pending orders
// Returns: baseCurrency, actualQuoteCurrency, actualBaseCurrency, error
func (s *OrderExecutionService) ExecuteSpotTrade(
	ctx context.Context,
	tx pgx.Tx,
	accountID uuid.UUID,
	symbol string,
	side models.OrderSide,
	amountBase float64,
	executionPrice float64,
	quoteCurrency string,
) (baseCurrency string, actualQuote string, actualBase string, err error) {
	// Calculate notional value and fees
	notionalValue := amountBase * executionPrice
	feeRate := 0.001 // 0.1% trading fee (standard for exchanges)
	fee := notionalValue * feeRate

	// Extract base currency from symbol (e.g., BTC from BTCUSDT)
	baseCurrency = symbol[:len(symbol)-len(quoteCurrency)]

	if side == models.OrderSideBuy {
		// BUY: Deduct quote currency (USDT) + fee, Add base currency (BTC)
		requiredAmount := notionalValue + fee
		actualQuoteCurrency, currentBalance, err := s.getBalanceWithFallback(ctx, tx, accountID, quoteCurrency)
		if err != nil {
			return "", "", "", err
		}

		if currentBalance < requiredAmount {
			return "", "", "", fmt.Errorf("insufficient %s balance (required: %.8f, available: %.8f)", actualQuoteCurrency, requiredAmount, currentBalance)
		}

		// Deduct quote currency + fee
		_, err = tx.Exec(ctx,
			`UPDATE balances SET amount = amount - $1, updated_at = NOW()
			 WHERE account_id = $2 AND currency = $3`,
			requiredAmount, accountID, actualQuoteCurrency,
		)
		if err != nil {
			return "", "", "", fmt.Errorf("failed to deduct quote currency: %w", err)
		}

		// Add base currency
		_, err = tx.Exec(ctx,
			`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
			 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
			 ON CONFLICT (account_id, currency)
			 DO UPDATE SET amount = balances.amount + $3, updated_at = NOW()`,
			accountID, baseCurrency, amountBase,
		)
		if err != nil {
			return "", "", "", fmt.Errorf("failed to add base currency: %w", err)
		}

		return baseCurrency, actualQuoteCurrency, "", nil

	} else { // SELL
		// SELL: Deduct base currency (BTC), Add quote currency (USDT) - fee
		actualBaseCurrency, currentBalance, err := s.getBalanceWithFallback(ctx, tx, accountID, baseCurrency)
		if err != nil {
			return "", "", "", err
		}

		if currentBalance < amountBase {
			return "", "", "", fmt.Errorf("insufficient %s balance (required: %.8f, available: %.8f)", actualBaseCurrency, amountBase, currentBalance)
		}

		// Deduct base currency
		_, err = tx.Exec(ctx,
			`UPDATE balances SET amount = amount - $1, updated_at = NOW()
			 WHERE account_id = $2 AND currency = $3`,
			amountBase, accountID, actualBaseCurrency,
		)
		if err != nil {
			return "", "", "", fmt.Errorf("failed to deduct base currency: %w", err)
		}

		// Add quote currency (notional - fee)
		receiveAmount := notionalValue - fee
		actualQuoteCurrency, _, err := s.getBalanceWithFallback(ctx, tx, accountID, quoteCurrency)
		if err != nil {
			return "", "", "", err
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO balances (id, account_id, currency, amount, created_at, updated_at)
			 VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
			 ON CONFLICT (account_id, currency)
			 DO UPDATE SET amount = balances.amount + $3, updated_at = NOW()`,
			accountID, actualQuoteCurrency, receiveAmount,
		)
		if err != nil {
			return "", "", "", fmt.Errorf("failed to add quote currency: %w", err)
		}

		return baseCurrency, actualQuoteCurrency, actualBaseCurrency, nil
	}
}

// executeSpotOrder executes a spot order (non-leveraged)
// This now delegates to ExecuteSpotTrade for the actual balance updates
func (s *OrderExecutionService) executeSpotOrder(
	ctx context.Context,
	tx pgx.Tx,
	order *models.Order,
	executionPrice float64,
	_ float64, // notionalValue - unused, calculated in ExecuteSpotTrade
	fee float64,
	_ string, // accountCurrency - unused
	quoteCurrency string,
) (*ExecutionResult, error) {
	// Use shared spot trading logic
	_, _, _, err := s.ExecuteSpotTrade(ctx, tx, order.AccountID, order.Symbol, order.Side, order.AmountBase, executionPrice, quoteCurrency)
	if err != nil {
		// Check if it's an insufficient balance error (not a system error)
		if isInsufficientBalanceError(err) {
			return &ExecutionResult{
				Order:   *order,
				Success: false,
				Message: err.Error(),
			}, nil
		}
		return nil, err
	}

	// Update order status
	_, err = tx.Exec(ctx,
		`UPDATE orders SET status = $1, filled_amount = $2, average_fill_price = $3, updated_at = NOW()
		 WHERE id = $4`,
		models.OrderStatusFilled, order.AmountBase, executionPrice, order.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update order status: %w", err)
	}

	// Update order object
	order.Status = models.OrderStatusFilled
	order.FilledAmount = order.AmountBase
	avgPrice := executionPrice
	order.AverageFillPrice = &avgPrice
	order.UpdatedAt = time.Now()

	return &ExecutionResult{
		Order:   *order,
		Success: true,
		Message: fmt.Sprintf("order executed successfully at price %.8f with fee %.8f %s", executionPrice, fee, quoteCurrency),
	}, nil
}

// ExecuteDualPositionOrder executes a hedged order (opens both Long and Short positions simultaneously)
// This implements the "dual-position hedging" strategy for CFD/Futures products
func (s *OrderExecutionService) ExecuteDualPositionOrder(
	ctx context.Context,
	tx pgx.Tx,
	order *models.Order,
	executionPrice float64,
	notionalValue float64,
	fee float64,
	accountCurrency string,
) (*ExecutionResult, error) {
	// Get instrument type and max leverage from appropriate configuration table
	var instrumentType string
	err := tx.QueryRow(ctx,
		`SELECT instrument_type FROM instruments WHERE symbol = $1`,
		order.Symbol,
	).Scan(&instrumentType)
	if err != nil {
		return nil, fmt.Errorf("failed to get instrument type: %w", err)
	}

	// Get max leverage from the appropriate configuration table
	var maxLeverage int
	if instrumentType == "forex" {
		// Forex instruments: read from forex_configurations.max_leverage
		err = tx.QueryRow(ctx,
			`SELECT max_leverage FROM forex_configurations WHERE symbol = $1`,
			order.Symbol,
		).Scan(&maxLeverage)
		if err != nil {
			return nil, fmt.Errorf("failed to get forex max leverage: %w", err)
		}
	} else {
		// Crypto/Commodity instruments: read from spot_configurations or use high default
		// TODO: Add max_leverage column to spot_configurations table
		// For now, use generous limits: 100x for commodities, 50x for crypto
		if instrumentType == "commodity" {
			maxLeverage = 100
		} else {
			maxLeverage = 50 // Crypto default
		}
	}

	// Use user-selected leverage from order (default to 1 if not set)
	leverage := order.Leverage
	if leverage < 1 {
		leverage = 1
	}

	// Validate leverage doesn't exceed instrument's cap
	if leverage > maxLeverage {
		return &ExecutionResult{
			Order:   *order,
			Success: false,
			Message: fmt.Sprintf("leverage %dx exceeds instrument maximum of %dx", leverage, maxLeverage),
		}, nil
	}

	// Calculate required margin PER POSITION
	marginPerPosition := (notionalValue / float64(leverage)) + (fee / 2.0) // Split fee between both positions

	// CRITICAL: Calculate TOTAL margin required (2x for dual position)
	totalMarginRequired := marginPerPosition * 2.0

	// Check if account has enough balance for 2x margin
	actualAccountCurrency, currentBalance, err := s.getBalanceWithFallback(ctx, tx, order.AccountID, accountCurrency)
	if err != nil {
		return nil, err
	}

	if currentBalance < totalMarginRequired {
		return &ExecutionResult{
			Order:   *order,
			Success: false,
			Message: fmt.Sprintf("insufficient %s balance for hedged position (required: %.8f for 2x margin, available: %.8f)", actualAccountCurrency, totalMarginRequired, currentBalance),
		}, nil
	}

	// Deduct TOTAL margin (2x) from balance
	_, err = tx.Exec(ctx,
		`UPDATE balances SET amount = amount - $1, updated_at = NOW()
		 WHERE account_id = $2 AND currency = $3`,
		totalMarginRequired, order.AccountID, actualAccountCurrency,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to deduct margin: %w", err)
	}

	// Generate pair_id to link both positions
	pairID := uuid.New()

	// Generate contract numbers for both positions
	var longContractNumber, shortContractNumber string
	err = tx.QueryRow(ctx, "SELECT generate_contract_number()").Scan(&longContractNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to generate long contract number: %w", err)
	}
	err = tx.QueryRow(ctx, "SELECT generate_contract_number()").Scan(&shortContractNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to generate short contract number: %w", err)
	}

	// Calculate liquidation prices for both positions
	marginRatio := 1.0 / float64(leverage) * 0.9
	longLiquidationPrice := executionPrice * (1.0 - marginRatio)
	shortLiquidationPrice := executionPrice * (1.0 + marginRatio)

	// PERFORMANCE: Batch insert both positions in a single query (reduces DB round-trips)
	longContractID := uuid.New()
	shortContractID := uuid.New()
	_, err = tx.Exec(ctx,
		`INSERT INTO contracts (id, user_id, account_id, symbol, contract_number, side, status,
		                        lot_size, entry_price, margin_used, leverage, commission, liquidation_price, pair_id, created_at, updated_at)
		 VALUES
		   ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()),
		   ($15, $2, $3, $4, $16, $17, $7, $8, $9, $10, $11, $12, $18, $14, NOW(), NOW())`,
		// Long position (values $1-$14)
		longContractID, order.UserID, order.AccountID, order.Symbol, longContractNumber,
		models.ContractSideLong, models.ContractStatusOpen, order.AmountBase, executionPrice,
		marginPerPosition-(fee/2.0), leverage, fee/2.0, longLiquidationPrice, pairID,
		// Short position (values $15-$18, reuses $2-$14 where applicable)
		shortContractID, shortContractNumber, models.ContractSideShort, shortLiquidationPrice,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create dual positions: %w", err)
	}

	// Update order status
	_, err = tx.Exec(ctx,
		`UPDATE orders SET status = $1, filled_amount = $2, average_fill_price = $3, updated_at = NOW()
		 WHERE id = $4`,
		models.OrderStatusFilled, order.AmountBase, executionPrice, order.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update order status: %w", err)
	}

	// Fetch both contracts (return long contract as primary)
	var longContract models.Contract
	err = tx.QueryRow(ctx,
		`SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size,
		        entry_price, margin_used, leverage, liquidation_price, tp_price, sl_price, close_price, pnl,
		        swap, commission, created_at, closed_at, updated_at
		 FROM contracts WHERE id = $1`,
		longContractID,
	).Scan(
		&longContract.ID, &longContract.UserID, &longContract.AccountID, &longContract.Symbol, &longContract.ContractNumber,
		&longContract.Side, &longContract.Status, &longContract.LotSize, &longContract.EntryPrice, &longContract.MarginUsed,
		&longContract.Leverage, &longContract.LiquidationPrice, &longContract.TPPrice, &longContract.SLPrice, &longContract.ClosePrice, &longContract.PnL,
		&longContract.Swap, &longContract.Commission, &longContract.CreatedAt, &longContract.ClosedAt, &longContract.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch long contract: %w", err)
	}

	// Update order object
	order.Status = models.OrderStatusFilled
	order.FilledAmount = order.AmountBase
	avgPrice := executionPrice
	order.AverageFillPrice = &avgPrice
	order.UpdatedAt = time.Now()

	return &ExecutionResult{
		Order:    *order,
		Contract: &longContract, // Return long contract as primary reference
		Success:  true,
		Message:  fmt.Sprintf("hedged position opened: LONG %s and SHORT %s at price %.8f (pair_id: %s)", longContractNumber, shortContractNumber, executionPrice, pairID.String()),
	}, nil
}

// ExecuteExternalOrder executes an order via external LP (A-Book routing)
// After LP execution, creates internal dual positions using the LP fill price
func (s *OrderExecutionService) ExecuteExternalOrder(
	ctx context.Context,
	tx pgx.Tx,
	order *models.Order,
	lpProvider string,
	notionalValue float64,
	fee float64,
	accountCurrency string,
) (*ExecutionResult, error) {
	// Import LP package for execution
	// This is where we'd use the ProviderManager to get the LP
	// For now, we'll simulate the LP execution path

	// In production, this would be:
	// providerManager := GetGlobalProviderManager()
	// lp, err := providerManager.GetProvider(lpProvider)
	// if err != nil {
	//     return nil, fmt.Errorf("LP provider not found: %w", err)
	// }

	// Convert order to LP execution request
	// lpReq := &lp.ExecutionRequest{
	//     OrderID:   order.ID,
	//     Symbol:    order.Symbol,
	//     Side:      convertOrderSideToLP(order.Side),
	//     Quantity:  decimal.NewFromFloat(order.AmountBase),
	//     OrderType: "market",
	// }

	// Execute on LP
	// lpReport, err := lp.ExecuteOrder(ctx, lpReq)
	// if err != nil {
	//     return &ExecutionResult{
	//         Order:   *order,
	//         Success: false,
	//         Message: fmt.Sprintf("LP execution failed: %v", err),
	//     }, nil
	// }

	// For now, use a mock execution price (in production, use lpReport.AveragePrice)
	executionPrice := notionalValue / order.AmountBase // Current market price

	// Record LP routing
	lpRouteID := uuid.New()
	_, err := tx.Exec(ctx,
		`INSERT INTO lp_routes (id, order_id, lp_provider, lp_order_id, lp_fill_price, lp_fill_quantity, lp_fee, status, routed_at, filled_at, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW(), NOW())`,
		lpRouteID, order.ID, lpProvider, fmt.Sprintf("LP-%s", uuid.New().String()[:8]),
		executionPrice, order.AmountBase, fee, "filled",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to record LP route: %w", err)
	}

	// Update order execution_strategy to a_book
	_, err = tx.Exec(ctx,
		`UPDATE orders SET execution_strategy = 'a_book', updated_at = NOW() WHERE id = $1`,
		order.ID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update execution strategy: %w", err)
	}

	// Now create internal dual positions using LP fill price
	// This ensures our internal books match the external hedge
	result, err := s.ExecuteDualPositionOrder(ctx, tx, order, executionPrice, notionalValue, fee, accountCurrency)
	if err != nil {
		return nil, fmt.Errorf("failed to create internal positions after LP execution: %w", err)
	}

	// Update result message to indicate A-Book execution
	result.Message = fmt.Sprintf("A-Book execution: %s - %s", lpProvider, result.Message)

	return result, nil
}

// GetCurrentMarketPrice fetches the current market price for a symbol from the database or API
func (s *OrderExecutionService) GetCurrentMarketPrice(ctx context.Context, symbol string) (float64, error) {
	// This is a placeholder - in production, you would fetch from:
	// 1. Your real-time price cache/Redis
	// 2. Binance API
	// 3. Internal price aggregator

	// For now, we'll use Binance API
	// TODO: Replace with your price service
	return 0, fmt.Errorf("price fetching not implemented - pass execution price from caller")
}

// ValidateOrderExecution checks if an order can be executed
func (s *OrderExecutionService) ValidateOrderExecution(ctx context.Context, orderID uuid.UUID, currentPrice float64) (bool, string, error) {
	var orderType models.OrderType
	var limitPrice, stopPrice *float64
	var side models.OrderSide

	err := s.pool.QueryRow(ctx,
		"SELECT type, side, limit_price, stop_price FROM orders WHERE id = $1",
		orderID,
	).Scan(&orderType, &side, &limitPrice, &stopPrice)
	if err != nil {
		return false, "", fmt.Errorf("failed to fetch order: %w", err)
	}

	switch orderType {
	case models.OrderTypeMarket:
		// Market orders can always execute
		return true, "market order", nil

	case models.OrderTypeLimit:
		if limitPrice == nil {
			return false, "limit price not set", nil
		}
		// Buy limit: execute when market price <= limit price
		// Sell limit: execute when market price >= limit price
		if side == models.OrderSideBuy && currentPrice <= *limitPrice {
			return true, "buy limit triggered", nil
		}
		if side == models.OrderSideSell && currentPrice >= *limitPrice {
			return true, "sell limit triggered", nil
		}
		return false, fmt.Sprintf("limit price not reached (current: %.8f, limit: %.8f)", currentPrice, *limitPrice), nil

	case models.OrderTypeStop:
		if stopPrice == nil {
			return false, "stop price not set", nil
		}
		// Buy stop: execute when market price >= stop price
		// Sell stop: execute when market price <= stop price
		if side == models.OrderSideBuy && currentPrice >= *stopPrice {
			return true, "buy stop triggered", nil
		}
		if side == models.OrderSideSell && currentPrice <= *stopPrice {
			return true, "sell stop triggered", nil
		}
		return false, fmt.Sprintf("stop price not reached (current: %.8f, stop: %.8f)", currentPrice, *stopPrice), nil

	case models.OrderTypeStopLimit:
		if stopPrice == nil || limitPrice == nil {
			return false, "stop price or limit price not set", nil
		}
		// First check if stop is triggered
		stopTriggered := false
		if side == models.OrderSideBuy && currentPrice >= *stopPrice {
			stopTriggered = true
		}
		if side == models.OrderSideSell && currentPrice <= *stopPrice {
			stopTriggered = true
		}
		if !stopTriggered {
			return false, "stop not triggered yet", nil
		}
		// Then check limit
		if side == models.OrderSideBuy && currentPrice <= *limitPrice {
			return true, "stop-limit buy triggered", nil
		}
		if side == models.OrderSideSell && currentPrice >= *limitPrice {
			return true, "stop-limit sell triggered", nil
		}
		return false, "stop triggered but limit not met", nil

	default:
		return false, fmt.Sprintf("unknown order type: %s", orderType), nil
	}
}

// LogOrderExecution logs order execution for audit trail
func (s *OrderExecutionService) LogOrderExecution(ctx context.Context, result *ExecutionResult) {
	if result.Success {
		log.Printf("[ORDER EXECUTION] Order %s executed successfully: %s", result.Order.OrderNumber, result.Message)
		if result.Contract != nil {
			log.Printf("[CONTRACT OPENED] Contract %s opened for order %s", result.Contract.ContractNumber, result.Order.OrderNumber)
		}
	} else {
		log.Printf("[ORDER EXECUTION FAILED] Order %s: %s", result.Order.OrderNumber, result.Message)
	}
}
