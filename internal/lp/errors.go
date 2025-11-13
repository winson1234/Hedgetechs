package lp

import (
	"errors"
	"fmt"
)

var (
	// ErrProviderNotFound indicates the requested LP provider is not registered
	ErrProviderNotFound = errors.New("liquidity provider not found")

	// ErrNoPrimaryProvider indicates no primary LP has been configured
	ErrNoPrimaryProvider = errors.New("no primary liquidity provider configured")

	// ErrNoFallbackProvider indicates no fallback LP has been configured
	ErrNoFallbackProvider = errors.New("no fallback liquidity provider configured")

	// ErrInsufficientLiquidity indicates the LP cannot fulfill the order
	ErrInsufficientLiquidity = errors.New("insufficient liquidity at LP")

	// ErrConnectionFailed indicates connection to LP failed
	ErrConnectionFailed = errors.New("connection to liquidity provider failed")

	// ErrInvalidResponse indicates LP returned invalid data
	ErrInvalidResponse = errors.New("invalid response from liquidity provider")

	// ErrOrderRejected indicates LP rejected the order
	ErrOrderRejected = errors.New("order rejected by liquidity provider")

	// ErrTimeout indicates LP request timed out
	ErrTimeout = errors.New("liquidity provider request timed out")

	// ErrInsufficientBalance indicates insufficient balance at LP
	ErrInsufficientBalance = errors.New("insufficient balance at liquidity provider")
)

// CombinedError represents multiple errors from failover attempts
type CombinedError struct {
	PrimaryError  error
	FallbackError error
}

func (e *CombinedError) Error() string {
	return fmt.Sprintf("primary LP failed: %v; fallback LP failed: %v", e.PrimaryError, e.FallbackError)
}

// CombineErrors creates a CombinedError from two errors
func CombineErrors(primary, fallback error) error {
	return &CombinedError{
		PrimaryError:  primary,
		FallbackError: fallback,
	}
}
