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

	// Fetch order details
	var order models.Order
	var accountCurrency, productType, quoteCurrency string
	err = tx.QueryRow(ctx,
		`SELECT o.id, o.user_id, o.account_id, o.symbol, o.order_number, o.side, o.type,
		        o.status, o.amount_base, o.limit_price, o.stop_price, o.leverage, o.filled_amount,
		        o.average_fill_price, o.created_at, o.updated_at,
		        a.currency, a.product_type,
		        i.quote_currency
		 FROM orders o
		 JOIN accounts a ON o.account_id = a.id
		 JOIN instruments i ON o.symbol = i.symbol
		 WHERE o.id = $1`,
		orderID,
	).Scan(
		&order.ID, &order.UserID, &order.AccountID, &order.Symbol, &order.OrderNumber,
		&order.Side, &order.Type, &order.Status, &order.AmountBase, &order.LimitPrice,
		&order.StopPrice, &order.Leverage, &order.FilledAmount, &order.AverageFillPrice,
		&order.CreatedAt, &order.UpdatedAt,
		&accountCurrency, &productType, &quoteCurrency,
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

	// Check if this is spot or leveraged trading
	isSpot := productType == "spot"

	var result *ExecutionResult
	if isSpot {
		result, err = s.executeSpotOrder(ctx, tx, &order, executionPrice, notionalValue, fee, accountCurrency, quoteCurrency)
	} else {
		result, err = s.executeLeveragedOrder(ctx, tx, &order, executionPrice, notionalValue, fee, accountCurrency, quoteCurrency, productType)
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

// executeLeveragedOrder executes a leveraged order (CFD/Futures)
func (s *OrderExecutionService) executeLeveragedOrder(
	ctx context.Context,
	tx pgx.Tx,
	order *models.Order,
	executionPrice float64,
	notionalValue float64,
	fee float64,
	accountCurrency string,
	_ string, // quoteCurrency - unused in leveraged orders
	_ string, // productType - unused, could be used for different contract types in future
) (*ExecutionResult, error) {
	// For leveraged trading, we create a contract (position) instead of exchanging currencies

	// Get instrument leverage cap for validation
	var leverageCap int
	err := tx.QueryRow(ctx,
		`SELECT leverage_cap FROM instruments WHERE symbol = $1`,
		order.Symbol,
	).Scan(&leverageCap)
	if err != nil {
		return nil, fmt.Errorf("failed to get leverage cap: %w", err)
	}

	// Use user-selected leverage from order (default to 1 if not set)
	leverage := order.Leverage
	if leverage < 1 {
		leverage = 1
	}

	// Validate leverage doesn't exceed instrument's cap
	if leverage > leverageCap {
		return &ExecutionResult{
			Order:   *order,
			Success: false,
			Message: fmt.Sprintf("leverage %dx exceeds instrument cap of %dx", leverage, leverageCap),
		}, nil
	}

	// Calculate required margin
	marginRequired := (notionalValue / float64(leverage)) + fee

	// Check if account has enough balance for margin (with USD/USDT fallback)
	actualAccountCurrency, currentBalance, err := s.getBalanceWithFallback(ctx, tx, order.AccountID, accountCurrency)
	if err != nil {
		return nil, err
	}

	if currentBalance < marginRequired {
		return &ExecutionResult{
			Order:   *order,
			Success: false,
			Message: fmt.Sprintf("insufficient %s balance for margin (required: %.8f, available: %.8f)", actualAccountCurrency, marginRequired, currentBalance),
		}, nil
	}

	// Deduct margin from balance (using actual currency found)
	_, err = tx.Exec(ctx,
		`UPDATE balances SET amount = amount - $1, updated_at = NOW()
		 WHERE account_id = $2 AND currency = $3`,
		marginRequired, order.AccountID, actualAccountCurrency,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to deduct margin: %w", err)
	}

	// Generate contract number
	var contractNumber string
	err = tx.QueryRow(ctx, "SELECT generate_contract_number()").Scan(&contractNumber)
	if err != nil {
		return nil, fmt.Errorf("failed to generate contract number: %w", err)
	}

	// Determine contract side (long for buy, short for sell)
	var contractSide models.ContractSide
	if order.Side == models.OrderSideBuy {
		contractSide = models.ContractSideLong
	} else {
		contractSide = models.ContractSideShort
	}

	// Calculate liquidation price (90% maintenance margin threshold)
	// Long: liquidationPrice = entryPrice × (1 - 1/leverage × 0.9)
	// Short: liquidationPrice = entryPrice × (1 + 1/leverage × 0.9)
	var liquidationPrice float64
	marginRatio := 1.0 / float64(leverage) * 0.9
	if contractSide == models.ContractSideLong {
		liquidationPrice = executionPrice * (1.0 - marginRatio)
	} else {
		liquidationPrice = executionPrice * (1.0 + marginRatio)
	}

	// Create contract (position)
	contractID := uuid.New()
	_, err = tx.Exec(ctx,
		`INSERT INTO contracts (id, user_id, account_id, symbol, contract_number, side, status,
		                        lot_size, entry_price, margin_used, leverage, commission, liquidation_price, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())`,
		contractID, order.UserID, order.AccountID, order.Symbol, contractNumber,
		contractSide, models.ContractStatusOpen, order.AmountBase, executionPrice,
		marginRequired-fee, leverage, fee, liquidationPrice,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create contract: %w", err)
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

	// Fetch created contract
	var contract models.Contract
	err = tx.QueryRow(ctx,
		`SELECT id, user_id, account_id, symbol, contract_number, side, status, lot_size,
		        entry_price, margin_used, leverage, liquidation_price, tp_price, sl_price, close_price, pnl,
		        swap, commission, created_at, closed_at, updated_at
		 FROM contracts WHERE id = $1`,
		contractID,
	).Scan(
		&contract.ID, &contract.UserID, &contract.AccountID, &contract.Symbol, &contract.ContractNumber,
		&contract.Side, &contract.Status, &contract.LotSize, &contract.EntryPrice, &contract.MarginUsed,
		&contract.Leverage, &contract.LiquidationPrice, &contract.TPPrice, &contract.SLPrice, &contract.ClosePrice, &contract.PnL,
		&contract.Swap, &contract.Commission, &contract.CreatedAt, &contract.ClosedAt, &contract.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch contract: %w", err)
	}

	// Update order object
	order.Status = models.OrderStatusFilled
	order.FilledAmount = order.AmountBase
	avgPrice := executionPrice
	order.AverageFillPrice = &avgPrice
	order.UpdatedAt = time.Now()

	return &ExecutionResult{
		Order:    *order,
		Contract: &contract,
		Success:  true,
		Message:  fmt.Sprintf("leveraged order executed successfully, contract %s opened at price %.8f", contractNumber, executionPrice),
	}, nil
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
