package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// DecimalPrice represents a decimal-based price for financial calculations
// This wrapper provides JSON marshaling/unmarshaling and database scanning
type DecimalPrice struct {
	decimal.Decimal
}

// NewDecimalPrice creates a new DecimalPrice from a string
func NewDecimalPrice(value string) (DecimalPrice, error) {
	d, err := decimal.NewFromString(value)
	if err != nil {
		return DecimalPrice{}, err
	}
	return DecimalPrice{d}, nil
}

// NewDecimalPriceFromFloat creates a new DecimalPrice from a float64
func NewDecimalPriceFromFloat(value float64) DecimalPrice {
	return DecimalPrice{decimal.NewFromFloat(value)}
}

// MarshalJSON implements json.Marshaler
func (d DecimalPrice) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String())
}

// UnmarshalJSON implements json.Unmarshaler
func (d *DecimalPrice) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		// Try to unmarshal as a number
		var f float64
		if err2 := json.Unmarshal(data, &f); err2 != nil {
			return err
		}
		d.Decimal = decimal.NewFromFloat(f)
		return nil
	}

	dec, err := decimal.NewFromString(s)
	if err != nil {
		return err
	}
	d.Decimal = dec
	return nil
}

// Scan implements sql.Scanner interface
func (d *DecimalPrice) Scan(value interface{}) error {
	if value == nil {
		d.Decimal = decimal.Zero
		return nil
	}

	switch v := value.(type) {
	case float64:
		d.Decimal = decimal.NewFromFloat(v)
		return nil
	case int64:
		d.Decimal = decimal.NewFromInt(v)
		return nil
	case []byte:
		dec, err := decimal.NewFromString(string(v))
		if err != nil {
			return err
		}
		d.Decimal = dec
		return nil
	case string:
		dec, err := decimal.NewFromString(v)
		if err != nil {
			return err
		}
		d.Decimal = dec
		return nil
	default:
		return fmt.Errorf("unsupported type %T for DecimalPrice", value)
	}
}

// Value implements driver.Valuer interface
func (d DecimalPrice) Value() (driver.Value, error) {
	return d.String(), nil
}

// IsZero returns true if the decimal is zero
func (d DecimalPrice) IsZero() bool {
	return d.Decimal.IsZero()
}

// ToFloat64 converts DecimalPrice to float64 (use only for display, not calculations!)
func (d DecimalPrice) ToFloat64() float64 {
	f, _ := d.Float64()
	return f
}

// DecimalQuantity represents a decimal-based quantity for financial calculations
// Alias for DecimalPrice but semantically different
type DecimalQuantity = DecimalPrice

// NewDecimalQuantity creates a new DecimalQuantity from a string
func NewDecimalQuantity(value string) (DecimalQuantity, error) {
	return NewDecimalPrice(value)
}

// NewDecimalQuantityFromFloat creates a new DecimalQuantity from a float64
func NewDecimalQuantityFromFloat(value float64) DecimalQuantity {
	return NewDecimalPriceFromFloat(value)
}

// ================================================================
// DECIMAL-BASED ORDER MODELS (V2)
// ================================================================

// OrderV2 represents a trading order with decimal precision
type OrderV2 struct {
	Order                     // Embed the original Order struct
	AmountBaseDecimal       DecimalQuantity  `json:"amount_base_decimal"`
	LimitPriceDecimal       *DecimalPrice    `json:"limit_price_decimal,omitempty"`
	StopPriceDecimal        *DecimalPrice    `json:"stop_price_decimal,omitempty"`
	FilledAmountDecimal     DecimalQuantity  `json:"filled_amount_decimal"`
	AverageFillPriceDecimal *DecimalPrice    `json:"average_fill_price_decimal,omitempty"`
	ProductType             ProductType      `json:"product_type"` // NEW: Product type at order level
	ExecutionStrategy       ExecutionStrategy `json:"execution_strategy"` // NEW: B-Book or A-Book
}

// CreateOrderRequestV2 represents the request to create an order with decimal precision
type CreateOrderRequestV2 struct {
	AccountID         uuid.UUID       `json:"account_id"`
	Symbol            string          `json:"symbol"`
	Side              OrderSide       `json:"side"`
	Type              OrderType       `json:"type"`
	AmountBase        DecimalQuantity `json:"amount_base"`
	LimitPrice        *DecimalPrice   `json:"limit_price,omitempty"`
	StopPrice         *DecimalPrice   `json:"stop_price,omitempty"`
	Leverage          int             `json:"leverage"`      // Leverage multiplier (default: 1)
	ProductType       ProductType     `json:"product_type"`  // NEW: "spot", "cfd", or "futures"
}

// ================================================================
// DECIMAL-BASED CONTRACT MODELS (V2)
// ================================================================

// ContractV2 represents an open position/contract with decimal precision
type ContractV2 struct {
	Contract                      // Embed the original Contract struct
	LotSizeDecimal       DecimalQuantity `json:"lot_size_decimal"`
	EntryPriceDecimal    DecimalPrice    `json:"entry_price_decimal"`
	MarginUsedDecimal    DecimalPrice    `json:"margin_used_decimal"`
	LiquidationPriceDecimal *DecimalPrice `json:"liquidation_price_decimal,omitempty"`
	TPPriceDecimal       *DecimalPrice   `json:"tp_price_decimal,omitempty"`
	SLPriceDecimal       *DecimalPrice   `json:"sl_price_decimal,omitempty"`
	ClosePriceDecimal    *DecimalPrice   `json:"close_price_decimal,omitempty"`
	PnLDecimal           *DecimalPrice   `json:"pnl_decimal,omitempty"`
	SwapDecimal          DecimalPrice    `json:"swap_decimal"`
	CommissionDecimal    DecimalPrice    `json:"commission_decimal"`
	PairID               *uuid.UUID      `json:"pair_id,omitempty"` // NEW: Links to hedged counterpart
}

// CreateContractRequestV2 represents the request to create a contract with decimal precision
type CreateContractRequestV2 struct {
	AccountID  uuid.UUID       `json:"account_id"`
	Symbol     string          `json:"symbol"`
	Side       ContractSide    `json:"side"`
	LotSize    DecimalQuantity `json:"lot_size"`
	EntryPrice DecimalPrice    `json:"entry_price"`
	Leverage   int             `json:"leverage"`
	TPPrice    *DecimalPrice   `json:"tp_price,omitempty"`
	SLPrice    *DecimalPrice   `json:"sl_price,omitempty"`
	PairID     *uuid.UUID      `json:"pair_id,omitempty"` // NEW: For hedged positions
}

// ================================================================
// DECIMAL-BASED BALANCE MODELS (V2)
// ================================================================

// BalanceV2 represents a currency balance with decimal precision
type BalanceV2 struct {
	Balance              // Embed the original Balance struct
	AmountDecimal DecimalPrice `json:"amount_decimal"`
}

// ================================================================
// EXECUTION STRATEGY
// ================================================================

// ExecutionStrategy represents the order routing strategy
type ExecutionStrategy string

const (
	ExecutionStrategyBBook ExecutionStrategy = "b_book" // Internal execution
	ExecutionStrategyABook ExecutionStrategy = "a_book" // External LP execution
)

// ================================================================
// LP ROUTING MODELS
// ================================================================

// LPRoute represents an order routed to a liquidity provider
type LPRoute struct {
	ID             uuid.UUID          `json:"id"`
	OrderID        uuid.UUID          `json:"order_id"`
	LPProvider     string             `json:"lp_provider"`
	LPOrderID      string             `json:"lp_order_id"`
	LPFillPrice    *DecimalPrice      `json:"lp_fill_price,omitempty"`
	LPFillQuantity *DecimalQuantity   `json:"lp_fill_quantity,omitempty"`
	LPFee          *DecimalPrice      `json:"lp_fee,omitempty"`
	Status         string             `json:"status"`
	RoutedAt       time.Time          `json:"routed_at"`
	FilledAt       *time.Time         `json:"filled_at,omitempty"`
	ErrorMessage   *string            `json:"error_message,omitempty"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
}

// ReconciliationQueueItem represents an item in the LP reconciliation queue
type ReconciliationQueueItem struct {
	ID                  uuid.UUID   `json:"id"`
	LPRouteID           uuid.UUID   `json:"lp_route_id"`
	Status              string      `json:"status"`
	Attempts            int         `json:"attempts"`
	LastAttemptAt       *time.Time  `json:"last_attempt_at,omitempty"`
	NextAttemptAt       time.Time   `json:"next_attempt_at"`
	DiscrepancyDetails  *string     `json:"discrepancy_details,omitempty"`
	ResolvedAt          *time.Time  `json:"resolved_at,omitempty"`
	CreatedAt           time.Time   `json:"created_at"`
	UpdatedAt           time.Time   `json:"updated_at"`
}

// ================================================================
// HELPER FUNCTIONS
// ================================================================

// ConvertOrderToV2 converts a float64-based Order to OrderV2
func ConvertOrderToV2(order Order) OrderV2 {
	v2 := OrderV2{
		Order:               order,
		AmountBaseDecimal:   NewDecimalQuantityFromFloat(order.AmountBase),
		FilledAmountDecimal: NewDecimalQuantityFromFloat(order.FilledAmount),
		ProductType:         ProductTypeSpot, // Default for legacy orders
		ExecutionStrategy:   ExecutionStrategyBBook, // Default for legacy orders
	}

	if order.LimitPrice != nil {
		price := NewDecimalPriceFromFloat(*order.LimitPrice)
		v2.LimitPriceDecimal = &price
	}

	if order.StopPrice != nil {
		price := NewDecimalPriceFromFloat(*order.StopPrice)
		v2.StopPriceDecimal = &price
	}

	if order.AverageFillPrice != nil {
		price := NewDecimalPriceFromFloat(*order.AverageFillPrice)
		v2.AverageFillPriceDecimal = &price
	}

	return v2
}

// ConvertContractToV2 converts a float64-based Contract to ContractV2
func ConvertContractToV2(contract Contract) ContractV2 {
	v2 := ContractV2{
		Contract:          contract,
		LotSizeDecimal:    NewDecimalQuantityFromFloat(contract.LotSize),
		EntryPriceDecimal: NewDecimalPriceFromFloat(contract.EntryPrice),
		MarginUsedDecimal: NewDecimalPriceFromFloat(contract.MarginUsed),
		SwapDecimal:       NewDecimalPriceFromFloat(contract.Swap),
		CommissionDecimal: NewDecimalPriceFromFloat(contract.Commission),
	}

	if contract.LiquidationPrice != nil {
		price := NewDecimalPriceFromFloat(*contract.LiquidationPrice)
		v2.LiquidationPriceDecimal = &price
	}

	if contract.TPPrice != nil {
		price := NewDecimalPriceFromFloat(*contract.TPPrice)
		v2.TPPriceDecimal = &price
	}

	if contract.SLPrice != nil {
		price := NewDecimalPriceFromFloat(*contract.SLPrice)
		v2.SLPriceDecimal = &price
	}

	if contract.ClosePrice != nil {
		price := NewDecimalPriceFromFloat(*contract.ClosePrice)
		v2.ClosePriceDecimal = &price
	}

	if contract.PnL != nil {
		pnl := NewDecimalPriceFromFloat(*contract.PnL)
		v2.PnLDecimal = &pnl
	}

	return v2
}

// ConvertBalanceToV2 converts a float64-based Balance to BalanceV2
func ConvertBalanceToV2(balance Balance) BalanceV2 {
	return BalanceV2{
		Balance:       balance,
		AmountDecimal: NewDecimalPriceFromFloat(balance.Amount),
	}
}
