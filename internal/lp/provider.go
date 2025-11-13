package lp

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// OrderSide represents the side of an order for LP execution
type OrderSide string

const (
	OrderSideBuy  OrderSide = "buy"
	OrderSideSell OrderSide = "sell"
)

// ExecutionRequest represents a request to execute an order with an LP
type ExecutionRequest struct {
	OrderID     uuid.UUID       `json:"order_id"`
	Symbol      string          `json:"symbol"`
	Side        OrderSide       `json:"side"`
	Quantity    decimal.Decimal `json:"quantity"`
	OrderType   string          `json:"order_type"` // "market", "limit"
	LimitPrice  *decimal.Decimal `json:"limit_price,omitempty"`
	ClientID    string          `json:"client_id"` // Internal reference
}

// ExecutionReport represents the result of an LP execution
type ExecutionReport struct {
	LPOrderID     string          `json:"lp_order_id"`     // LP's internal order ID
	Status        string          `json:"status"`          // "filled", "partial", "rejected", "pending"
	FilledQty     decimal.Decimal `json:"filled_qty"`
	RemainingQty  decimal.Decimal `json:"remaining_qty"`
	AveragePrice  decimal.Decimal `json:"average_price"`
	Fee           decimal.Decimal `json:"fee"`
	FeeCurrency   string          `json:"fee_currency"`
	ExecutionTime time.Time       `json:"execution_time"`
	ErrorMessage  string          `json:"error_message,omitempty"`
}

// BalanceInfo represents balance information from an LP
type BalanceInfo struct {
	Currency  string          `json:"currency"`
	Available decimal.Decimal `json:"available"`
	Locked    decimal.Decimal `json:"locked"`
	Total     decimal.Decimal `json:"total"`
}

// OrderStatusResponse represents the status of an order from LP
type OrderStatusResponse struct {
	LPOrderID      string          `json:"lp_order_id"`
	Status         string          `json:"status"`
	Symbol         string          `json:"symbol"`
	Side           OrderSide       `json:"side"`
	OriginalQty    decimal.Decimal `json:"original_qty"`
	ExecutedQty    decimal.Decimal `json:"executed_qty"`
	RemainingQty   decimal.Decimal `json:"remaining_qty"`
	AveragePrice   decimal.Decimal `json:"average_price"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// LiquidityProvider defines the interface for all LP integrations
// Implement this interface for each LP (Binance, FTX, custom brokers, etc.)
type LiquidityProvider interface {
	// Name returns the provider's name (e.g., "binance", "ftx", "mock_lp")
	Name() string

	// ExecuteOrder sends an order to the LP for execution
	// Returns an ExecutionReport with fill details or error
	ExecuteOrder(ctx context.Context, req *ExecutionRequest) (*ExecutionReport, error)

	// GetOrderStatus queries the LP for the status of a previously placed order
	// Used by reconciliation service to verify fills
	GetOrderStatus(ctx context.Context, lpOrderID string) (*OrderStatusResponse, error)

	// GetBalance retrieves account balance information from the LP
	// Used to verify we have sufficient funds for A-Book routing
	GetBalance(ctx context.Context, currency string) (*BalanceInfo, error)

	// CancelOrder attempts to cancel an order at the LP
	// Returns error if cancel fails or order already filled
	CancelOrder(ctx context.Context, lpOrderID string) error

	// HealthCheck verifies connectivity to the LP
	// Returns nil if healthy, error otherwise
	HealthCheck(ctx context.Context) error
}

// ProviderConfig holds configuration for LP connections
type ProviderConfig struct {
	Name       string            `json:"name"`
	Enabled    bool              `json:"enabled"`
	APIKey     string            `json:"api_key"`
	APISecret  string            `json:"api_secret"`
	BaseURL    string            `json:"base_url"`
	Timeout    time.Duration     `json:"timeout"`
	MaxRetries int               `json:"max_retries"`
	Metadata   map[string]string `json:"metadata"` // Provider-specific config
}

// ProviderManager manages multiple LP connections
type ProviderManager struct {
	providers map[string]LiquidityProvider
	primary   string
	fallback  string
}

// NewProviderManager creates a new manager for LP providers
func NewProviderManager() *ProviderManager {
	return &ProviderManager{
		providers: make(map[string]LiquidityProvider),
	}
}

// RegisterProvider adds a provider to the manager
func (pm *ProviderManager) RegisterProvider(name string, provider LiquidityProvider) {
	pm.providers[name] = provider
}

// SetPrimary sets the primary LP for routing
func (pm *ProviderManager) SetPrimary(name string) error {
	if _, exists := pm.providers[name]; !exists {
		return ErrProviderNotFound
	}
	pm.primary = name
	return nil
}

// SetFallback sets the fallback LP (optional)
func (pm *ProviderManager) SetFallback(name string) error {
	if _, exists := pm.providers[name]; !exists {
		return ErrProviderNotFound
	}
	pm.fallback = name
	return nil
}

// GetPrimary returns the primary provider
func (pm *ProviderManager) GetPrimary() (LiquidityProvider, error) {
	if pm.primary == "" {
		return nil, ErrNoPrimaryProvider
	}
	provider, exists := pm.providers[pm.primary]
	if !exists {
		return nil, ErrProviderNotFound
	}
	return provider, nil
}

// GetFallback returns the fallback provider (may be nil)
func (pm *ProviderManager) GetFallback() (LiquidityProvider, error) {
	if pm.fallback == "" {
		return nil, ErrNoFallbackProvider
	}
	provider, exists := pm.providers[pm.fallback]
	if !exists {
		return nil, ErrProviderNotFound
	}
	return provider, nil
}

// ExecuteWithFailover attempts to execute on primary, falls back if primary fails
func (pm *ProviderManager) ExecuteWithFailover(ctx context.Context, req *ExecutionRequest) (*ExecutionReport, string, error) {
	// Try primary provider
	primary, err := pm.GetPrimary()
	if err != nil {
		return nil, "", err
	}

	report, err := primary.ExecuteOrder(ctx, req)
	if err == nil {
		return report, primary.Name(), nil
	}

	// Primary failed, try fallback if available
	fallback, fbErr := pm.GetFallback()
	if fbErr != nil {
		// No fallback available, return primary error
		return nil, primary.Name(), err
	}

	// Attempt execution on fallback
	report, fbExecErr := fallback.ExecuteOrder(ctx, req)
	if fbExecErr != nil {
		// Both failed, return combined error
		return nil, fallback.Name(), CombineErrors(err, fbExecErr)
	}

	return report, fallback.Name(), nil
}

// GetProvider retrieves a provider by name
func (pm *ProviderManager) GetProvider(name string) (LiquidityProvider, error) {
	provider, exists := pm.providers[name]
	if !exists {
		return nil, ErrProviderNotFound
	}
	return provider, nil
}

// ListProviders returns all registered provider names
func (pm *ProviderManager) ListProviders() []string {
	names := make([]string, 0, len(pm.providers))
	for name := range pm.providers {
		names = append(names, name)
	}
	return names
}
