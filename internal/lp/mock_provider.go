package lp

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// MockLP is a simulated liquidity provider for testing
// It mimics real LP behavior without making external API calls
type MockLP struct {
	name            string
	simulateLatency time.Duration
	failureRate     float64 // 0.0 to 1.0, probability of order rejection
	slippageBps     int     // Slippage in basis points (e.g., 10 = 0.10%)
}

// NewMockLP creates a new mock liquidity provider
func NewMockLP(name string, config *ProviderConfig) *MockLP {
	latency := 100 * time.Millisecond
	if config != nil && config.Timeout > 0 {
		latency = config.Timeout / 10 // Simulate 10% of timeout as latency
	}

	return &MockLP{
		name:            name,
		simulateLatency: latency,
		failureRate:     0.02, // 2% default failure rate
		slippageBps:     5,    // 0.05% default slippage
	}
}

// Name returns the provider's name
func (m *MockLP) Name() string {
	return m.name
}

// ExecuteOrder simulates order execution
func (m *MockLP) ExecuteOrder(ctx context.Context, req *ExecutionRequest) (*ExecutionReport, error) {
	// Simulate network latency
	time.Sleep(m.simulateLatency)

	// Check context cancellation
	select {
	case <-ctx.Done():
		return nil, ErrTimeout
	default:
	}

	// Simulate random failures
	if rand.Float64() < m.failureRate {
		return &ExecutionReport{
			Status:       "rejected",
			ErrorMessage: "mock LP: insufficient liquidity",
		}, ErrInsufficientLiquidity
	}

	// Generate mock LP order ID
	lpOrderID := fmt.Sprintf("MOCK-%s", uuid.New().String()[:8])

	// Calculate slippage
	slippageMultiplier := decimal.NewFromInt(int64(m.slippageBps)).Div(decimal.NewFromInt(10000))

	// For market orders, simulate execution at current price +/- slippage
	var executionPrice decimal.Decimal
	if req.OrderType == "market" {
		// Use a mock current price (in real impl, this would come from price feed)
		mockCurrentPrice := decimal.NewFromFloat(50000.0) // Example: BTC price

		if req.Side == OrderSideBuy {
			// Buy orders slip up
			executionPrice = mockCurrentPrice.Mul(decimal.NewFromInt(1).Add(slippageMultiplier))
		} else {
			// Sell orders slip down
			executionPrice = mockCurrentPrice.Mul(decimal.NewFromInt(1).Sub(slippageMultiplier))
		}
	} else if req.LimitPrice != nil {
		// Limit orders execute at limit price (no slippage)
		executionPrice = *req.LimitPrice
	} else {
		executionPrice = decimal.NewFromFloat(50000.0)
	}

	// Calculate mock fee (0.1% taker fee)
	notionalValue := req.Quantity.Mul(executionPrice)
	fee := notionalValue.Mul(decimal.NewFromFloat(0.001))

	// Return successful execution report
	return &ExecutionReport{
		LPOrderID:     lpOrderID,
		Status:        "filled",
		FilledQty:     req.Quantity,
		RemainingQty:  decimal.Zero,
		AveragePrice:  executionPrice,
		Fee:           fee,
		FeeCurrency:   "USDT",
		ExecutionTime: time.Now(),
		ErrorMessage:  "",
	}, nil
}

// GetOrderStatus simulates order status query
func (m *MockLP) GetOrderStatus(ctx context.Context, lpOrderID string) (*OrderStatusResponse, error) {
	// Simulate network latency
	time.Sleep(m.simulateLatency / 2)

	// Check context cancellation
	select {
	case <-ctx.Done():
		return nil, ErrTimeout
	default:
	}

	// Return mock status
	qty := decimal.NewFromFloat(1.0)
	price := decimal.NewFromFloat(50000.0)

	return &OrderStatusResponse{
		LPOrderID:    lpOrderID,
		Status:       "filled",
		Symbol:       "BTCUSDT",
		Side:         OrderSideBuy,
		OriginalQty:  qty,
		ExecutedQty:  qty,
		RemainingQty: decimal.Zero,
		AveragePrice: price,
		CreatedAt:    time.Now().Add(-1 * time.Minute),
		UpdatedAt:    time.Now(),
	}, nil
}

// GetBalance simulates balance query
func (m *MockLP) GetBalance(ctx context.Context, currency string) (*BalanceInfo, error) {
	// Simulate network latency
	time.Sleep(m.simulateLatency / 2)

	// Check context cancellation
	select {
	case <-ctx.Done():
		return nil, ErrTimeout
	default:
	}

	// Return mock balance (large enough for testing)
	available := decimal.NewFromInt(1000000) // 1M USDT available
	locked := decimal.NewFromInt(50000)      // 50K locked in open orders
	total := available.Add(locked)

	return &BalanceInfo{
		Currency:  currency,
		Available: available,
		Locked:    locked,
		Total:     total,
	}, nil
}

// CancelOrder simulates order cancellation
func (m *MockLP) CancelOrder(ctx context.Context, lpOrderID string) error {
	// Simulate network latency
	time.Sleep(m.simulateLatency / 2)

	// Check context cancellation
	select {
	case <-ctx.Done():
		return ErrTimeout
	default:
	}

	// Simulate 10% chance that order is already filled (cannot cancel)
	if rand.Float64() < 0.1 {
		return fmt.Errorf("order %s already filled, cannot cancel", lpOrderID)
	}

	return nil
}

// HealthCheck simulates health check
func (m *MockLP) HealthCheck(ctx context.Context) error {
	// Simulate network latency
	time.Sleep(m.simulateLatency / 2)

	// Check context cancellation
	select {
	case <-ctx.Done():
		return ErrTimeout
	default:
	}

	// Simulate 1% chance of unhealthy status
	if rand.Float64() < 0.01 {
		return ErrConnectionFailed
	}

	return nil
}

// SetFailureRate allows tests to configure failure probability
func (m *MockLP) SetFailureRate(rate float64) {
	if rate < 0 {
		rate = 0
	}
	if rate > 1 {
		rate = 1
	}
	m.failureRate = rate
}

// SetSlippage allows tests to configure slippage in basis points
func (m *MockLP) SetSlippage(bps int) {
	if bps < 0 {
		bps = 0
	}
	m.slippageBps = bps
}

// SetLatency allows tests to configure simulated network latency
func (m *MockLP) SetLatency(duration time.Duration) {
	m.simulateLatency = duration
}
