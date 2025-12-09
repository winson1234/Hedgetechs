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
	TransactionTypeDeposit       TransactionType = "deposit"
	TransactionTypeWithdrawal    TransactionType = "withdrawal"
	TransactionTypeTransfer      TransactionType = "transfer"
	TransactionTypePositionClose TransactionType = "position_close"
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
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	FullName  *string   `json:"full_name,omitempty"`
	Country   *string   `json:"country,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Account represents a trading account
type Account struct {
	ID            uuid.UUID     `json:"id"`
	UserID        int64         `json:"user_id"`               // bigint user_id for backward compatibility with admin panel
	AccountID     int64         `json:"account_id"`            // Auto-incrementing account number
	AccountNumber int64         `json:"account_number"`        // DEPRECATED: Alias for account_id (backward compatibility)
	Type          AccountType   `json:"type"`
	ProductType   *ProductType  `json:"product_type,omitempty"` // NULLABLE: Universal accounts have NULL product_type
	Currency      string        `json:"currency"`
	Status        AccountStatus `json:"status"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`

	// UX personalization fields (production features)
	Nickname       *string    `json:"nickname,omitempty"`         // User-defined nickname (e.g., "My Trading Account")
	Color          *string    `json:"color,omitempty"`            // Hex color code for visual identification
	Icon           *string    `json:"icon,omitempty"`             // Icon identifier (e.g., "wallet", "chart")
	LastAccessedAt *time.Time `json:"last_accessed_at,omitempty"` // Last time account was accessed
	AccessCount    int        `json:"access_count"`               // Total number of accesses

	// Balances will be populated when fetching account details
	Balances []Balance `json:"balances"`

	// Transient margin fields (calculated, not stored in DB)
	Equity        *float64 `json:"equity,omitempty"`
	UsedMargin    *float64 `json:"used_margin,omitempty"`
	FreeMargin    *float64 `json:"free_margin,omitempty"`
	MarginLevel   *float64 `json:"margin_level,omitempty"`
	UnrealizedPnL *float64 `json:"unrealized_pnl,omitempty"`
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
	TransactionNumber string            `json:"transaction_number"` // Display number: TXN-00001
	Type              TransactionType   `json:"type"`
	Currency          string            `json:"currency"`
	Amount            float64           `json:"amount"`
	Status            TransactionStatus `json:"status"`
	TargetAccountID   *uuid.UUID        `json:"target_account_id,omitempty"`
	ContractID        *uuid.UUID        `json:"contract_id,omitempty"`
	Description       *string           `json:"description,omitempty"`
	Metadata          map[string]any    `json:"metadata,omitempty"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
}

// CreateAccountRequest represents the request body for creating a new account
type CreateAccountRequest struct {
	Type           AccountType  `json:"type"`                       // "live" or "demo"
	ProductType    *ProductType `json:"product_type,omitempty"`     // DEPRECATED: Optional for backward compatibility. New accounts are universal.
	Currency       string       `json:"currency"`                   // e.g., "USD", "EUR"
	InitialBalance float64      `json:"initial_balance"`            // Initial balance amount
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

	// Validate product type (ONLY if provided - for backward compatibility)
	// New universal accounts should NOT set product_type
	if r.ProductType != nil {
		if *r.ProductType != ProductTypeSpot && *r.ProductType != ProductTypeCFD && *r.ProductType != ProductTypeFutures {
			return &ValidationError{Field: "product_type", Message: "must be 'spot', 'cfd', or 'futures' if provided"}
		}
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
	KYCDocumentTypePassport       KYCDocumentType = "passport"
	KYCDocumentTypeDriversLicense KYCDocumentType = "drivers_license"
	KYCDocumentTypeNationalID     KYCDocumentType = "national_id"
	KYCDocumentTypeProofOfAddress KYCDocumentType = "proof_of_address"
	KYCDocumentTypeSelfie         KYCDocumentType = "selfie"
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

// Instrument represents a tradeable instrument (master table)
type Instrument struct {
	Symbol         string    `json:"symbol"`
	InstrumentType string    `json:"instrument_type"` // crypto, forex, commodity
	BaseCurrency   string    `json:"base_currency"`
	QuoteCurrency  string    `json:"quote_currency"`
	IsTradeable    bool      `json:"is_tradable"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Nested configurations (populated via JOINs)
	SpotConfig  *SpotConfiguration  `json:"spot_config,omitempty"`
	ForexConfig *ForexConfiguration `json:"forex_config,omitempty"`
}

// SpotConfiguration represents crypto spot trading configuration
type SpotConfiguration struct {
	Symbol          string  `json:"symbol"`
	BasePrecision   int     `json:"base_precision"`
	QuotePrecision  int     `json:"quote_precision"`
	TickSize        float64 `json:"tick_size"`
	StepSize        float64 `json:"step_size"`
	MinQuantity     float64 `json:"min_quantity"`
	MaxQuantity     float64 `json:"max_quantity"`
	MinNotional     float64 `json:"min_notional"`
	MaxNotional     float64 `json:"max_notional"`
	MakerFeeRate    float64 `json:"maker_fee_rate"`
	TakerFeeRate    float64 `json:"taker_fee_rate"`
}

// ForexConfiguration represents forex trading configuration
type ForexConfiguration struct {
	Symbol         string  `json:"symbol"`
	Digits         int     `json:"digits"`
	ContractSize   int     `json:"contract_size"`
	PipSize        float64 `json:"pip_size"`
	MinLot         float64 `json:"min_lot"`
	MaxLot         float64 `json:"max_lot"`
	LotStep        float64 `json:"lot_step"`
	MaxLeverage    int     `json:"max_leverage"`
	MarginCurrency string  `json:"margin_currency"`
	StopLevel      int     `json:"stop_level"`
	FreezeLevel    int     `json:"freeze_level"`
	SwapEnable     bool    `json:"swap_enable"`
	SwapLong       float64 `json:"swap_long"`
	SwapShort      float64 `json:"swap_short"`
	SwapTripleDay  string  `json:"swap_triple_day"`
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
	OrderNumber      string      `json:"order_number"` // Display number: ORD-00001
	Side             OrderSide   `json:"side"`
	Type             OrderType   `json:"type"`
	Status           OrderStatus `json:"status"`
	AmountBase       float64     `json:"amount_base"`
	LimitPrice       *float64    `json:"limit_price,omitempty"`
	StopPrice        *float64    `json:"stop_price,omitempty"`
	Leverage         int         `json:"leverage"`      // Leverage multiplier (1 for spot, >1 for CFD/Futures)
	ProductType      ProductType `json:"product_type"`  // NEW: Product type at order level (spot, cfd, futures)
	FilledAmount     float64     `json:"filled_amount"`
	AverageFillPrice *float64    `json:"average_fill_price,omitempty"`
	CreatedAt        time.Time   `json:"created_at"`
	UpdatedAt        time.Time   `json:"updated_at"`
}

// CreateOrderRequest represents the request to create an order
type CreateOrderRequest struct {
	AccountID   uuid.UUID   `json:"account_id"`
	Symbol      string      `json:"symbol"`
	Side        OrderSide   `json:"side"`
	Type        OrderType   `json:"type"`
	AmountBase  float64     `json:"amount_base"`
	LimitPrice  *float64    `json:"limit_price,omitempty"`
	StopPrice   *float64    `json:"stop_price,omitempty"`
	Leverage    int         `json:"leverage"`     // Leverage multiplier (default: 1)
	ProductType ProductType `json:"product_type"` // NEW: "spot", "cfd", or "futures" - Required for universal accounts
}

// Validate validates the CreateOrderRequest
func (r *CreateOrderRequest) Validate() error {
	// Validate product type (required for universal accounts)
	if r.ProductType != ProductTypeSpot && r.ProductType != ProductTypeCFD && r.ProductType != ProductTypeFutures {
		return &ValidationError{Field: "product_type", Message: "must be 'spot', 'cfd', or 'futures'"}
	}

	// Validate symbol
	if r.Symbol == "" {
		return &ValidationError{Field: "symbol", Message: "is required"}
	}

	// Validate side
	if r.Side != OrderSideBuy && r.Side != OrderSideSell {
		return &ValidationError{Field: "side", Message: "must be 'buy' or 'sell'"}
	}

	// Validate type
	if r.Type != OrderTypeMarket && r.Type != OrderTypeLimit && r.Type != OrderTypeStop && r.Type != OrderTypeStopLimit {
		return &ValidationError{Field: "type", Message: "must be 'market', 'limit', 'stop', or 'stop_limit'"}
	}

	// Validate amount
	if r.AmountBase <= 0 {
		return &ValidationError{Field: "amount_base", Message: "must be greater than zero"}
	}

	// Validate leverage
	if r.Leverage < 1 {
		return &ValidationError{Field: "leverage", Message: "must be at least 1"}
	}

	// Spot orders cannot have leverage > 1
	if r.ProductType == ProductTypeSpot && r.Leverage > 1 {
		return &ValidationError{Field: "leverage", Message: "spot orders cannot have leverage greater than 1"}
	}

	// Limit orders require limit_price
	if r.Type == OrderTypeLimit && r.LimitPrice == nil {
		return &ValidationError{Field: "limit_price", Message: "is required for limit orders"}
	}

	// Stop orders require stop_price
	if (r.Type == OrderTypeStop || r.Type == OrderTypeStopLimit) && r.StopPrice == nil {
		return &ValidationError{Field: "stop_price", Message: "is required for stop orders"}
	}

	return nil
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
	ID               uuid.UUID      `json:"id"`
	UserID           uuid.UUID      `json:"user_id"`
	AccountID        uuid.UUID      `json:"account_id"`
	Symbol           string         `json:"symbol"`
	ContractNumber   string         `json:"contract_number"` // Display number: CNT-00001
	Side             ContractSide   `json:"side"`
	Status           ContractStatus `json:"status"`
	LotSize          float64        `json:"lot_size"`
	EntryPrice       float64        `json:"entry_price"`
	MarginUsed       float64        `json:"margin_used"`
	Leverage         int            `json:"leverage"`
	LiquidationPrice *float64       `json:"liquidation_price,omitempty"` // Price at which position gets liquidated
	TPPrice          *float64       `json:"tp_price,omitempty"`
	SLPrice          *float64       `json:"sl_price,omitempty"`
	ClosePrice       *float64       `json:"close_price,omitempty"`
	PnL              *float64       `json:"pnl,omitempty"`
	Swap             float64        `json:"swap"`
	Commission       float64        `json:"commission"`
	PairID           *uuid.UUID     `json:"pair_id,omitempty"` // Links hedged positions (dual-position mode)
	CreatedAt        time.Time      `json:"created_at"`
	ClosedAt         *time.Time     `json:"closed_at,omitempty"`
	UpdatedAt        time.Time      `json:"updated_at"`

	// Transient field (calculated, not stored in DB)
	UnrealizedPnL *float64 `json:"unrealized_pnl,omitempty"`
}

// CreateContractRequest represents the request to create a contract
type CreateContractRequest struct {
	AccountID  uuid.UUID    `json:"account_id"`
	Symbol     string       `json:"symbol"`
	Side       ContractSide `json:"side"`
	LotSize    float64      `json:"lot_size"`
	EntryPrice float64      `json:"entry_price"`
	Leverage   int          `json:"leverage"`
	TPPrice    *float64     `json:"tp_price,omitempty"`
	SLPrice    *float64     `json:"sl_price,omitempty"`
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

// ================================================================
// DEPOSIT MODELS
// ================================================================

// PaymentMethod represents the payment method for deposits
type PaymentMethod string

const (
	PaymentMethodTron PaymentMethod = "tron"
)

// DepositStatus represents the status of a deposit request
type DepositStatus string

const (
	DepositStatusPending  DepositStatus = "pending"
	DepositStatusApproved DepositStatus = "approved"
	DepositStatusRejected DepositStatus = "rejected"
	DepositStatusCancelled DepositStatus = "cancelled"
)

// Deposit represents a deposit request
type Deposit struct {
	ID             uuid.UUID              `json:"id"`
	UserID         int64                  `json:"user_id"`
	AccountID      uuid.UUID              `json:"account_id"`
	ReferenceID    string                 `json:"reference_id"` // DEP-YYYYMMDD-XXXXXX
	PaymentMethod  PaymentMethod          `json:"payment_method"`
	Amount         float64                `json:"amount"`
	Currency       string                 `json:"currency"`
	ReceiptFilePath *string               `json:"receipt_file_path,omitempty"`
	PaymentDetails map[string]interface{} `json:"payment_details,omitempty"`
	Status         DepositStatus          `json:"status"`
	TransactionID  *uuid.UUID             `json:"transaction_id,omitempty"`
	AdminNotes     *string                `json:"admin_notes,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
}

// CreateDepositRequest represents the request to create a deposit
type CreateDepositRequest struct {
	AccountID      uuid.UUID              `json:"account_id"`
	PaymentMethod  PaymentMethod          `json:"payment_method"`
	Amount         float64                `json:"amount"`
	Currency       string                 `json:"currency"`
	PaymentDetails map[string]interface{} `json:"payment_details,omitempty"`
}

// Validate validates the CreateDepositRequest
func (r *CreateDepositRequest) Validate() error {
	// Validate payment method (only Tron supported)
	if r.PaymentMethod != PaymentMethodTron {
		return &ValidationError{Field: "payment_method", Message: "only 'tron' payment method is supported"}
	}

	// Validate amount (minimum $5.00, maximum $100,000.00)
	if r.Amount < 5.0 {
		return &ValidationError{Field: "amount", Message: "minimum deposit amount is $5.00"}
	}
	if r.Amount > 100000.0 {
		return &ValidationError{Field: "amount", Message: "maximum deposit amount is $100,000.00"}
	}

	// Validate currency
	if r.Currency == "" {
		return &ValidationError{Field: "currency", Message: "currency is required"}
	}

	return nil
}

// CreateDepositResponse represents the response after creating a deposit
type CreateDepositResponse struct {
	Deposit Deposit `json:"deposit"`
	Message string  `json:"message"`
}
