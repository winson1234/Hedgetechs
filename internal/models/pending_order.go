package models

import (
	"time"

	"github.com/google/uuid"
)

// OrderExecutionType represents the execution type of a pending order
type OrderExecutionType string

const (
	OrderExecutionTypeLimit     OrderExecutionType = "limit"
	OrderExecutionTypeStopLimit OrderExecutionType = "stop_limit"
)

// PendingOrderStatus represents the status of a pending order
type PendingOrderStatus string

const (
	PendingOrderStatusPending   PendingOrderStatus = "pending"
	PendingOrderStatusExecuted  PendingOrderStatus = "executed"
	PendingOrderStatusCancelled PendingOrderStatus = "cancelled"
	PendingOrderStatusExpired   PendingOrderStatus = "expired"
	PendingOrderStatusFailed    PendingOrderStatus = "failed"
)

// PendingOrder represents a limit or stop-limit order awaiting execution
type PendingOrder struct {
	ID             uuid.UUID          `json:"id"`
	UserID         uuid.UUID          `json:"user_id"`
	AccountID      uuid.UUID          `json:"account_id"`
	OrderNumber    *string            `json:"order_number,omitempty"` // Human-readable order ID (e.g., "ORD-00042")
	Symbol         string             `json:"symbol"`         // e.g., "BTCUSDT", "ETHUSDT"
	Type           OrderExecutionType `json:"type"`           // "limit" or "stop_limit"
	Side           OrderSide          `json:"side"`           // "buy" or "sell"
	Quantity       float64            `json:"quantity"`       // Amount to buy/sell
	TriggerPrice   float64            `json:"trigger_price"`  // Price at which order triggers
	LimitPrice     *float64           `json:"limit_price,omitempty"` // Limit price (optional)
	Status         PendingOrderStatus `json:"status"`         // Current status
	ExecutedAt     *time.Time         `json:"executed_at,omitempty"` // When executed
	ExecutedPrice  *float64           `json:"executed_price,omitempty"` // Actual execution price
	FailureReason  *string            `json:"failure_reason,omitempty"` // If failed
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
}

// CreatePendingOrderRequest represents the request to create a pending order
type CreatePendingOrderRequest struct {
	AccountID    uuid.UUID          `json:"account_id"`
	Symbol       string             `json:"symbol"`
	Type         OrderExecutionType `json:"type"`         // "limit" or "stop_limit"
	Side         OrderSide          `json:"side"`         // "buy" or "sell"
	Quantity     float64            `json:"quantity"`     // Amount to buy/sell
	TriggerPrice float64            `json:"trigger_price"` // Price at which order triggers
	LimitPrice   *float64           `json:"limit_price,omitempty"` // Optional limit price
}

// CreatePendingOrderResponse represents the response after creating a pending order
type CreatePendingOrderResponse struct {
	Order   PendingOrder `json:"order"`
	Message string       `json:"message"`
}

// GetPendingOrdersResponse represents the response when fetching pending orders
type GetPendingOrdersResponse struct {
	Orders []PendingOrder `json:"orders"`
}

// CancelPendingOrderResponse represents the response after cancelling a pending order
type CancelPendingOrderResponse struct {
	Order   PendingOrder `json:"order"`
	Message string       `json:"message"`
}

// Validate validates the CreatePendingOrderRequest
func (r *CreatePendingOrderRequest) Validate() error {
	// Validate account ID
	if r.AccountID == uuid.Nil {
		return &ValidationError{Field: "account_id", Message: "is required"}
	}

	// Validate symbol
	if r.Symbol == "" {
		return &ValidationError{Field: "symbol", Message: "is required"}
	}

	// Validate type
	if r.Type != OrderExecutionTypeLimit && r.Type != OrderExecutionTypeStopLimit {
		return &ValidationError{Field: "type", Message: "must be 'limit' or 'stop_limit'"}
	}

	// Validate side
	if r.Side != OrderSideBuy && r.Side != OrderSideSell {
		return &ValidationError{Field: "side", Message: "must be 'buy' or 'sell'"}
	}

	// Validate quantity
	if r.Quantity <= 0 {
		return &ValidationError{Field: "quantity", Message: "must be greater than zero"}
	}

	// Validate trigger price
	if r.TriggerPrice <= 0 {
		return &ValidationError{Field: "trigger_price", Message: "must be greater than zero"}
	}

	// Validate limit price for limit orders
	if r.Type == OrderExecutionTypeLimit && r.LimitPrice == nil {
		return &ValidationError{Field: "limit_price", Message: "is required for limit orders"}
	}

	if r.LimitPrice != nil && *r.LimitPrice <= 0 {
		return &ValidationError{Field: "limit_price", Message: "must be greater than zero"}
	}

	return nil
}

// ShouldExecute determines if a pending order should be executed based on current price
// This is the core logic used by the event-driven order processor
func (po *PendingOrder) ShouldExecute(currentPrice float64) bool {
	// Only process pending orders
	if po.Status != PendingOrderStatusPending {
		return false
	}

	// Limit orders: Execute when price reaches or crosses trigger price
	if po.Type == OrderExecutionTypeLimit {
		if po.Side == OrderSideBuy {
			// Buy limit: Execute when price drops to or below trigger price
			return currentPrice <= po.TriggerPrice
		} else {
			// Sell limit: Execute when price rises to or above trigger price
			return currentPrice >= po.TriggerPrice
		}
	}

	// Stop-limit orders: Trigger at stop price BUT only if limit price is still valid
	// This prevents execution if market gaps past the limit (gap protection)
	if po.Type == OrderExecutionTypeStopLimit {
		if po.LimitPrice == nil {
			// Stop-limit requires a limit price
			return false
		}

		if po.Side == OrderSideBuy {
			// Buy stop-limit: Execute when price rises to or above trigger price
			// BUT only if current price is still at or below the limit price
			// Example: Stop at $50,000, Limit at $51,000
			// - Price at $50,500: ✅ Execute (stop hit, within limit)
			// - Price at $52,000: ❌ Don't execute (stop hit, but gapped past limit)
			return currentPrice >= po.TriggerPrice && currentPrice <= *po.LimitPrice
		} else {
			// Sell stop-limit: Execute when price drops to or below trigger price
			// BUT only if current price is still at or above the limit price
			// Example: Stop at $50,000, Limit at $49,000
			// - Price at $49,500: ✅ Execute (stop hit, within limit)
			// - Price at $48,000: ❌ Don't execute (stop hit, but gapped past limit)
			return currentPrice <= po.TriggerPrice && currentPrice >= *po.LimitPrice
		}
	}

	return false
}

// GetExecutionPrice returns the price at which the order should execute
// Implements traditional "best execution" - provides price improvement when available
func (po *PendingOrder) GetExecutionPrice(currentPrice float64) float64 {
	// If no limit price, execute at current market price
	if po.LimitPrice == nil {
		return currentPrice
	}

	// Best execution logic: give user the better price when possible
	if po.Side == OrderSideBuy {
		// Buy orders: Never pay more than limit price
		// If market is cheaper, execute at market price (price improvement)
		if currentPrice < *po.LimitPrice {
			return currentPrice
		}
		return *po.LimitPrice
	} else {
		// Sell orders: Never receive less than limit price
		// If market is higher, execute at market price (price improvement)
		if currentPrice > *po.LimitPrice {
			return currentPrice
		}
		return *po.LimitPrice
	}
}
