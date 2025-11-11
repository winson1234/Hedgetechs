package models

import (
	"time"

	"github.com/google/uuid"
)

// AccountType represents the type of trading account
type AccountType string

const (
	AccountTypeLive AccountType = "live"
	AccountTypeDemo AccountType = "demo"
)

// ProductType represents the trading product type
type ProductType string

const (
	ProductTypeSpot    ProductType = "spot"
	ProductTypeCFD     ProductType = "cfd"
	ProductTypeFutures ProductType = "futures"
)

// AccountStatus represents the status of an account
type AccountStatus string

const (
	AccountStatusActive      AccountStatus = "active"
	AccountStatusDeactivated AccountStatus = "deactivated"
	AccountStatusSuspended   AccountStatus = "suspended"
)

// TransactionType represents the type of transaction
type TransactionType string

const (
	TransactionTypeDeposit    TransactionType = "deposit"
	TransactionTypeWithdrawal TransactionType = "withdrawal"
	TransactionTypeTransfer   TransactionType = "transfer"
)

// TransactionStatus represents the status of a transaction
type TransactionStatus string

const (
	TransactionStatusPending   TransactionStatus = "pending"
	TransactionStatusCompleted TransactionStatus = "completed"
	TransactionStatusFailed    TransactionStatus = "failed"
)

// User represents a user profile (extends auth.users)
type User struct {
	ID        uuid.UUID  `json:"id"`
	Email     string     `json:"email"`
	FullName  *string    `json:"full_name,omitempty"`
	Country   *string    `json:"country,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// Account represents a trading account
type Account struct {
	ID            uuid.UUID     `json:"id"`
	UserID        uuid.UUID     `json:"user_id"`
	AccountNumber string        `json:"account_number"`
	Type          AccountType   `json:"type"`
	ProductType   ProductType   `json:"product_type"`
	Currency      string        `json:"currency"`
	Status        AccountStatus `json:"status"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`

	// UX personalization fields (production features)
	Nickname       *string    `json:"nickname,omitempty"`        // User-defined nickname (e.g., "My Trading Account")
	Color          *string    `json:"color,omitempty"`           // Hex color code for visual identification
	Icon           *string    `json:"icon,omitempty"`            // Icon identifier (e.g., "wallet", "chart")
	LastAccessedAt *time.Time `json:"last_accessed_at,omitempty"` // Last time account was accessed
	AccessCount    int        `json:"access_count"`              // Total number of accesses

	// Balances will be populated when fetching account details
	Balances []Balance `json:"balances,omitempty"`
}

// Balance represents a currency balance for an account
type Balance struct {
	ID        uuid.UUID `json:"id"`
	AccountID uuid.UUID `json:"account_id"`
	Currency  string    `json:"currency"`
	Amount    float64   `json:"amount"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Transaction represents a financial transaction
type Transaction struct {
	ID                uuid.UUID         `json:"id"`
	AccountID         uuid.UUID         `json:"account_id"`
	TransactionNumber string            `json:"transaction_number"`  // Display number: TXN-00001
	Type              TransactionType   `json:"type"`
	Currency          string            `json:"currency"`
	Amount            float64           `json:"amount"`
	Status            TransactionStatus `json:"status"`
	TargetAccountID   *uuid.UUID        `json:"target_account_id,omitempty"`
	Description       *string           `json:"description,omitempty"`
	Metadata          map[string]any    `json:"metadata,omitempty"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
}

// CreateAccountRequest represents the request body for creating a new account
type CreateAccountRequest struct {
	Type           AccountType `json:"type"`           // "live" or "demo"
	ProductType    ProductType `json:"product_type"`   // "spot", "cfd", or "futures"
	Currency       string      `json:"currency"`       // e.g., "USD", "EUR"
	InitialBalance float64     `json:"initial_balance"` // Initial balance amount
}

// CreateAccountResponse represents the response after creating a new account
type CreateAccountResponse struct {
	Account  Account   `json:"account"`
	Balances []Balance `json:"balances"`
}

// GetAccountsResponse represents the response when fetching all user accounts
type GetAccountsResponse struct {
	Accounts []Account `json:"accounts"`
}

// UpdateAccountMetadataRequest represents the request to update account personalization
type UpdateAccountMetadataRequest struct {
	Nickname *string `json:"nickname,omitempty"` // User-defined nickname
	Color    *string `json:"color,omitempty"`    // Hex color code (e.g., "#6366f1")
	Icon     *string `json:"icon,omitempty"`     // Icon identifier (e.g., "wallet", "chart")
}

// UpdateAccountMetadataResponse represents the response after updating account metadata
type UpdateAccountMetadataResponse struct {
	Account Account `json:"account"`
	Message string  `json:"message"`
}

// ErrorResponse represents a standard error response
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
	Code    int    `json:"code"`
}

// Validate validates the CreateAccountRequest
func (r *CreateAccountRequest) Validate() error {
	// Validate account type
	if r.Type != AccountTypeLive && r.Type != AccountTypeDemo {
		return &ValidationError{Field: "type", Message: "must be 'live' or 'demo'"}
	}

	// Validate product type
	if r.ProductType != ProductTypeSpot && r.ProductType != ProductTypeCFD && r.ProductType != ProductTypeFutures {
		return &ValidationError{Field: "product_type", Message: "must be 'spot', 'cfd', or 'futures'"}
	}

	// Validate currency
	if r.Currency == "" {
		return &ValidationError{Field: "currency", Message: "is required"}
	}

	// Validate initial balance
	if r.InitialBalance < 0 {
		return &ValidationError{Field: "initial_balance", Message: "must be non-negative"}
	}

	// Demo accounts require an initial balance
	if r.Type == AccountTypeDemo && r.InitialBalance == 0 {
		return &ValidationError{Field: "initial_balance", Message: "demo accounts must have an initial balance"}
	}

	return nil
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Message
}

// ================================================================
// KYC DOCUMENT MODELS
// ================================================================

// KYCDocumentType represents the type of KYC document
type KYCDocumentType string

const (
	KYCDocumentTypePassport        KYCDocumentType = "passport"
	KYCDocumentTypeDriversLicense  KYCDocumentType = "drivers_license"
	KYCDocumentTypeNationalID      KYCDocumentType = "national_id"
	KYCDocumentTypeProofOfAddress  KYCDocumentType = "proof_of_address"
	KYCDocumentTypeSelfie          KYCDocumentType = "selfie"
)

// KYCStatus represents the status of a KYC document
type KYCStatus string

const (
	KYCStatusPending  KYCStatus = "pending"
	KYCStatusApproved KYCStatus = "approved"
	KYCStatusRejected KYCStatus = "rejected"
)

// KYCDocument represents a KYC document upload
type KYCDocument struct {
	ID           uuid.UUID       `json:"id"`
	UserID       uuid.UUID       `json:"user_id"`
	DocumentType KYCDocumentType `json:"document_type"`
	FilePath     string          `json:"file_path"`
	Status       KYCStatus       `json:"status"`
	Notes        *string         `json:"notes,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// ================================================================
// INSTRUMENT MODELS
// ================================================================

// Instrument represents a tradeable instrument
type Instrument struct {
	Symbol               string    `json:"symbol"`
	Name                 *string   `json:"name,omitempty"`
	BaseCurrency         *string   `json:"base_currency,omitempty"`
	QuoteCurrency        *string   `json:"quote_currency,omitempty"`
	InstrumentType       *string   `json:"instrument_type,omitempty"` // crypto, forex, commodity
	IsTradeable          bool      `json:"is_tradeable"`
	LeverageCap          int       `json:"leverage_cap"`
	SpreadAdjustmentBps  int       `json:"spread_adjustment_bps"`
	MinOrderSize         *float64  `json:"min_order_size,omitempty"`
	MaxOrderSize         *float64  `json:"max_order_size,omitempty"`
	TickSize             *float64  `json:"tick_size,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}

// ================================================================
// ORDER MODELS
// ================================================================

// OrderSide represents the side of an order
type OrderSide string

const (
	OrderSideBuy  OrderSide = "buy"
	OrderSideSell OrderSide = "sell"
)

// OrderType represents the type of an order
type OrderType string

const (
	OrderTypeMarket    OrderType = "market"
	OrderTypeLimit     OrderType = "limit"
	OrderTypeStop      OrderType = "stop"
	OrderTypeStopLimit OrderType = "stop_limit"
)

// OrderStatus represents the status of an order
type OrderStatus string

const (
	OrderStatusPending         OrderStatus = "pending"
	OrderStatusFilled          OrderStatus = "filled"
	OrderStatusPartiallyFilled OrderStatus = "partially_filled"
	OrderStatusCancelled       OrderStatus = "cancelled"
	OrderStatusRejected        OrderStatus = "rejected"
)

// Order represents a trading order
type Order struct {
	ID               uuid.UUID   `json:"id"`
	UserID           uuid.UUID   `json:"user_id"`
	AccountID        uuid.UUID   `json:"account_id"`
	Symbol           string      `json:"symbol"`
	OrderNumber      string      `json:"order_number"`  // Display number: ORD-00001
	Side             OrderSide   `json:"side"`
	Type             OrderType   `json:"type"`
	Status           OrderStatus `json:"status"`
	AmountBase       float64     `json:"amount_base"`
	LimitPrice       *float64    `json:"limit_price,omitempty"`
	StopPrice        *float64    `json:"stop_price,omitempty"`
	FilledAmount     float64     `json:"filled_amount"`
	AverageFillPrice *float64    `json:"average_fill_price,omitempty"`
	CreatedAt        time.Time   `json:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at"`
}

// CreateOrderRequest represents the request to create an order
type CreateOrderRequest struct {
	AccountID  uuid.UUID `json:"account_id"`
	Symbol     string    `json:"symbol"`
	Side       OrderSide `json:"side"`
	Type       OrderType `json:"type"`
	AmountBase float64   `json:"amount_base"`
	LimitPrice *float64  `json:"limit_price,omitempty"`
	StopPrice  *float64  `json:"stop_price,omitempty"`
}

// ================================================================
// CONTRACT MODELS
// ================================================================

// ContractSide represents the side of a contract
type ContractSide string

const (
	ContractSideLong  ContractSide = "long"
	ContractSideShort ContractSide = "short"
)

// ContractStatus represents the status of a contract
type ContractStatus string

const (
	ContractStatusOpen       ContractStatus = "open"
	ContractStatusClosed     ContractStatus = "closed"
	ContractStatusLiquidated ContractStatus = "liquidated"
)

// Contract represents an open position/contract
type Contract struct {
	ID             uuid.UUID      `json:"id"`
	UserID         uuid.UUID      `json:"user_id"`
	AccountID      uuid.UUID      `json:"account_id"`
	Symbol         string         `json:"symbol"`
	ContractNumber string         `json:"contract_number"`  // Display number: CNT-00001
	Side           ContractSide   `json:"side"`
	Status         ContractStatus `json:"status"`
	LotSize        float64        `json:"lot_size"`
	EntryPrice     float64        `json:"entry_price"`
	MarginUsed     float64        `json:"margin_used"`
	Leverage       int            `json:"leverage"`
	TPPrice        *float64       `json:"tp_price,omitempty"`
	SLPrice        *float64       `json:"sl_price,omitempty"`
	ClosePrice     *float64       `json:"close_price,omitempty"`
	PnL            *float64       `json:"pnl,omitempty"`
	Swap           float64        `json:"swap"`
	Commission     float64        `json:"commission"`
	CreatedAt      time.Time      `json:"created_at"`
	ClosedAt       *time.Time     `json:"closed_at,omitempty"`
	UpdatedAt      time.Time      `json:"updated_at"`
}

// CreateContractRequest represents the request to create a contract
type CreateContractRequest struct {
	AccountID  uuid.UUID `json:"account_id"`
	Symbol     string    `json:"symbol"`
	Side       ContractSide `json:"side"`
	LotSize    float64   `json:"lot_size"`
	EntryPrice float64   `json:"entry_price"`
	Leverage   int       `json:"leverage"`
	TPPrice    *float64  `json:"tp_price,omitempty"`
	SLPrice    *float64  `json:"sl_price,omitempty"`
}

// UpdateContractTPSLRequest represents the request to update TP/SL
type UpdateContractTPSLRequest struct {
	TPPrice *float64 `json:"tp_price,omitempty"`
	SLPrice *float64 `json:"sl_price,omitempty"`
}

// CloseContractRequest represents the request to close a contract
type CloseContractRequest struct {
	ClosePrice float64 `json:"close_price"`
}
