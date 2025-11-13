package services

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// RoutingDecision represents the result of a routing decision
type RoutingDecision struct {
	Strategy          string // "b_book" or "a_book"
	Reason            string // Explanation for the routing decision
	ShouldRouteToLP   bool
	EstimatedNotional decimal.Decimal
}

// RoutingConfig holds the configuration for LP routing decisions
type RoutingConfig struct {
	Enabled                bool            `json:"enabled"`
	SizeThresholdUSD       decimal.Decimal `json:"size_threshold_usd"`        // Route orders above this notional
	ExposureLimitPerInstr  decimal.Decimal `json:"exposure_limit_per_instr"`  // Max net exposure per instrument
	ExposureLimitTotal     decimal.Decimal `json:"exposure_limit_total"`      // Max total net exposure
	PrimaryLPProvider      string          `json:"primary_lp_provider"`
	FallbackLPProvider     string          `json:"fallback_lp_provider"`
}

// RoutingService handles LP routing decisions
type RoutingService struct {
	pool   *pgxpool.Pool
	config *RoutingConfig
	mu     sync.RWMutex
}

// NewRoutingService creates a new routing decision service
func NewRoutingService(pool *pgxpool.Pool) *RoutingService {
	service := &RoutingService{
		pool: pool,
		config: &RoutingConfig{
			Enabled:               false,                                    // Disabled by default
			SizeThresholdUSD:      decimal.NewFromInt(100000),               // $100k
			ExposureLimitPerInstr: decimal.NewFromInt(500000),               // $500k per instrument
			ExposureLimitTotal:    decimal.NewFromInt(5000000),              // $5M total
			PrimaryLPProvider:     "mock_lp",
			FallbackLPProvider:    "",
		},
	}

	// Load config from database
	_ = service.LoadConfig(context.Background())

	return service
}

// LoadConfig loads routing configuration from the database
func (rs *RoutingService) LoadConfig(ctx context.Context) error {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	// Load enabled flag
	var enabledValue string
	err := rs.pool.QueryRow(ctx,
		"SELECT config_value FROM lp_routing_config WHERE config_key = 'enabled'",
	).Scan(&enabledValue)

	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("failed to load enabled config: %w", err)
	}

	if err == nil {
		var enabledConfig struct {
			Value bool `json:"value"`
		}
		if err := json.Unmarshal([]byte(enabledValue), &enabledConfig); err == nil {
			rs.config.Enabled = enabledConfig.Value
		}
	}

	// Load size threshold
	var thresholdValue string
	err = rs.pool.QueryRow(ctx,
		"SELECT config_value FROM lp_routing_config WHERE config_key = 'size_threshold'",
	).Scan(&thresholdValue)

	if err == nil {
		var thresholdConfig struct {
			Value int `json:"value"`
		}
		if err := json.Unmarshal([]byte(thresholdValue), &thresholdConfig); err == nil {
			rs.config.SizeThresholdUSD = decimal.NewFromInt(int64(thresholdConfig.Value))
		}
	}

	// Load exposure limits
	var exposureValue string
	err = rs.pool.QueryRow(ctx,
		"SELECT config_value FROM lp_routing_config WHERE config_key = 'exposure_limits'",
	).Scan(&exposureValue)

	if err == nil {
		var exposureConfig struct {
			PerInstrument int `json:"per_instrument"`
			Total         int `json:"total"`
		}
		if err := json.Unmarshal([]byte(exposureValue), &exposureConfig); err == nil {
			rs.config.ExposureLimitPerInstr = decimal.NewFromInt(int64(exposureConfig.PerInstrument))
			rs.config.ExposureLimitTotal = decimal.NewFromInt(int64(exposureConfig.Total))
		}
	}

	// Load LP providers
	var providersValue string
	err = rs.pool.QueryRow(ctx,
		"SELECT config_value FROM lp_routing_config WHERE config_key = 'lp_providers'",
	).Scan(&providersValue)

	if err == nil {
		var providersConfig struct {
			Primary  string  `json:"primary"`
			Fallback *string `json:"fallback"`
		}
		if err := json.Unmarshal([]byte(providersValue), &providersConfig); err == nil {
			rs.config.PrimaryLPProvider = providersConfig.Primary
			if providersConfig.Fallback != nil {
				rs.config.FallbackLPProvider = *providersConfig.Fallback
			}
		}
	}

	return nil
}

// GetConfig returns a copy of the current configuration
func (rs *RoutingService) GetConfig() RoutingConfig {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	return *rs.config
}

// ShouldRouteToLP determines if an order should be routed to LP
func (rs *RoutingService) ShouldRouteToLP(ctx context.Context, symbol string, side string, quantity, price decimal.Decimal) (*RoutingDecision, error) {
	config := rs.GetConfig()

	// If LP routing is disabled globally, always B-Book
	if !config.Enabled {
		return &RoutingDecision{
			Strategy:          "b_book",
			Reason:            "LP routing is disabled",
			ShouldRouteToLP:   false,
			EstimatedNotional: quantity.Mul(price),
		}, nil
	}

	// Calculate order notional value in USD
	notional := quantity.Mul(price)

	// Decision 1: Size threshold
	if notional.GreaterThan(config.SizeThresholdUSD) {
		return &RoutingDecision{
			Strategy:          "a_book",
			Reason:            fmt.Sprintf("Order notional ($%s) exceeds threshold ($%s)", notional.StringFixed(2), config.SizeThresholdUSD.StringFixed(2)),
			ShouldRouteToLP:   true,
			EstimatedNotional: notional,
		}, nil
	}

	// Decision 2: Check net exposure for this instrument
	netExposure, err := rs.getNetExposure(ctx, symbol)
	if err != nil {
		// If we can't determine exposure, default to B-Book (safer)
		return &RoutingDecision{
			Strategy:          "b_book",
			Reason:            fmt.Sprintf("Failed to determine exposure: %v", err),
			ShouldRouteToLP:   false,
			EstimatedNotional: notional,
		}, nil
	}

	// Calculate what new exposure would be after this order
	// Buy = positive exposure, Sell = negative exposure
	var exposureChange decimal.Decimal
	if side == "buy" {
		exposureChange = notional
	} else {
		exposureChange = notional.Neg()
	}

	newExposure := netExposure.Add(exposureChange).Abs()

	// If new exposure would exceed per-instrument limit, route to LP
	if newExposure.GreaterThan(config.ExposureLimitPerInstr) {
		return &RoutingDecision{
			Strategy:          "a_book",
			Reason:            fmt.Sprintf("New exposure ($%s) would exceed per-instrument limit ($%s)", newExposure.StringFixed(2), config.ExposureLimitPerInstr.StringFixed(2)),
			ShouldRouteToLP:   true,
			EstimatedNotional: notional,
		}, nil
	}

	// Decision 3: Check total exposure across all instruments
	totalExposure, err := rs.getTotalNetExposure(ctx)
	if err != nil {
		// If we can't determine total exposure, default to B-Book
		return &RoutingDecision{
			Strategy:          "b_book",
			Reason:            fmt.Sprintf("Failed to determine total exposure: %v", err),
			ShouldRouteToLP:   false,
			EstimatedNotional: notional,
		}, nil
	}

	newTotalExposure := totalExposure.Add(exposureChange).Abs()

	if newTotalExposure.GreaterThan(config.ExposureLimitTotal) {
		return &RoutingDecision{
			Strategy:          "a_book",
			Reason:            fmt.Sprintf("New total exposure ($%s) would exceed limit ($%s)", newTotalExposure.StringFixed(2), config.ExposureLimitTotal.StringFixed(2)),
			ShouldRouteToLP:   true,
			EstimatedNotional: notional,
		}, nil
	}

	// All checks passed, keep order internal (B-Book)
	return &RoutingDecision{
		Strategy:          "b_book",
		Reason:            "Order size and exposure within B-Book limits",
		ShouldRouteToLP:   false,
		EstimatedNotional: notional,
	}, nil
}

// getNetExposure calculates the current net exposure for a specific instrument
// Net Exposure = Sum of (Long Positions) - Sum of (Short Positions)
func (rs *RoutingService) getNetExposure(ctx context.Context, symbol string) (decimal.Decimal, error) {
	var netExposure *string

	query := `
		SELECT
			SUM(CASE
				WHEN side = 'long' THEN lot_size * entry_price
				ELSE -(lot_size * entry_price)
			END) as net_exposure
		FROM contracts
		WHERE symbol = $1 AND status = 'open'
	`

	err := rs.pool.QueryRow(ctx, query, symbol).Scan(&netExposure)
	if err != nil {
		return decimal.Zero, err
	}

	if netExposure == nil {
		return decimal.Zero, nil
	}

	exposure, err := decimal.NewFromString(*netExposure)
	if err != nil {
		return decimal.Zero, err
	}

	return exposure, nil
}

// getTotalNetExposure calculates the total net exposure across all instruments
func (rs *RoutingService) getTotalNetExposure(ctx context.Context) (decimal.Decimal, error) {
	var totalExposure *string

	query := `
		SELECT
			SUM(CASE
				WHEN side = 'long' THEN lot_size * entry_price
				ELSE -(lot_size * entry_price)
			END) as total_exposure
		FROM contracts
		WHERE status = 'open'
	`

	err := rs.pool.QueryRow(ctx, query).Scan(&totalExposure)
	if err != nil {
		return decimal.Zero, err
	}

	if totalExposure == nil {
		return decimal.Zero, nil
	}

	exposure, err := decimal.NewFromString(*totalExposure)
	if err != nil {
		return decimal.Zero, err
	}

	return exposure, nil
}

// UpdateConfig updates a single configuration value
func (rs *RoutingService) UpdateConfig(ctx context.Context, key string, value interface{}) error {
	rs.mu.Lock()
	defer rs.mu.Unlock()

	// Update in-memory config
	switch key {
	case "enabled":
		if v, ok := value.(bool); ok {
			rs.config.Enabled = v
		}
	case "size_threshold_usd":
		if v, ok := value.(int64); ok {
			rs.config.SizeThresholdUSD = decimal.NewFromInt(v)
		}
	case "exposure_limit_per_instr":
		if v, ok := value.(int64); ok {
			rs.config.ExposureLimitPerInstr = decimal.NewFromInt(v)
		}
	case "exposure_limit_total":
		if v, ok := value.(int64); ok {
			rs.config.ExposureLimitTotal = decimal.NewFromInt(v)
		}
	}

	// Persist to database
	jsonValue, err := json.Marshal(map[string]interface{}{"value": value})
	if err != nil {
		return err
	}

	_, err = rs.pool.Exec(ctx,
		"UPDATE lp_routing_config SET config_value = $1, updated_at = NOW() WHERE config_key = $2",
		string(jsonValue), key,
	)

	return err
}
