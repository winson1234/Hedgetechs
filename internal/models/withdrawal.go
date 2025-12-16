package models

import (
	"time"

	"github.com/google/uuid"
)

// WithdrawalStatus represents the status of a withdrawal request
type WithdrawalStatus string

const (
	WithdrawalStatusPending    WithdrawalStatus = "pending"
	WithdrawalStatusApproved   WithdrawalStatus = "approved"
	WithdrawalStatusRejected   WithdrawalStatus = "rejected"
	WithdrawalStatusCancelled  WithdrawalStatus = "cancelled"
	WithdrawalStatusProcessing WithdrawalStatus = "processing"
	WithdrawalStatusCompleted  WithdrawalStatus = "completed"
)

// WithdrawalMethod represents the withdrawal method
type WithdrawalMethod string

const (
	WithdrawalMethodTron         WithdrawalMethod = "tron"
	WithdrawalMethodBankTransfer WithdrawalMethod = "bank_transfer"
	WithdrawalMethodWire         WithdrawalMethod = "wire"
)

// Withdrawal represents a withdrawal request
type Withdrawal struct {
	ID               uuid.UUID               `json:"id"`
	UserID           int64                   `json:"user_id"`
	AccountID        uuid.UUID               `json:"account_id"`
	ReferenceID      string                  `json:"reference_id"`
	WithdrawalMethod WithdrawalMethod        `json:"withdrawal_method"`
	Amount           float64                 `json:"amount"`            // Original amount requested
	FeeAmount        float64                 `json:"fee_amount"`        // Fee charged
	NetAmount        float64                 `json:"net_amount"`        // Amount after fees
	Currency         string                  `json:"currency"`
	WithdrawalDetails map[string]interface{} `json:"withdrawal_details,omitempty"`
	Status           WithdrawalStatus        `json:"status"`
	TransactionID    *uuid.UUID              `json:"transaction_id,omitempty"`
	AdminNotes       *string                 `json:"admin_notes,omitempty"`
	
	// Audit fields
	ClientIP    *string    `json:"client_ip,omitempty"`
	AdminIP     *string    `json:"admin_ip,omitempty"`
	ApprovedAt  *time.Time `json:"approved_at,omitempty"`
	RejectedAt  *time.Time `json:"rejected_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	ApprovedBy  *int64     `json:"approved_by,omitempty"`
	RejectedBy  *int64     `json:"rejected_by,omitempty"`
	
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateWithdrawalRequest represents the request to create a withdrawal
type CreateWithdrawalRequest struct {
	AccountID         uuid.UUID               `json:"account_id"`
	WithdrawalMethod  string                  `json:"withdrawal_method"`
	Amount            float64                 `json:"amount"`
	Currency          string                  `json:"currency"`
	WithdrawalDetails map[string]interface{}  `json:"withdrawal_details,omitempty"`
	SaveForReuse      bool                    `json:"save_for_reuse,omitempty"` // Flag to save withdrawal method
}

// Validate validates the CreateWithdrawalRequest
func (r *CreateWithdrawalRequest) Validate() error {
	// Validate account ID
	if r.AccountID == uuid.Nil {
		return &ValidationError{Field: "account_id", Message: "account_id is required"}
	}

	// Validate withdrawal method
	validMethods := map[string]bool{
		string(WithdrawalMethodTron):         true,
		string(WithdrawalMethodBankTransfer): true,
		string(WithdrawalMethodWire):         true,
	}
	if !validMethods[r.WithdrawalMethod] {
		return &ValidationError{Field: "withdrawal_method", Message: "invalid withdrawal method"}
	}

	// Validate amount (min: $10, max: $100,000)
	if r.Amount < 10.0 {
		return &ValidationError{Field: "amount", Message: "minimum withdrawal amount is $10.00"}
	}
	if r.Amount > 100000.0 {
		return &ValidationError{Field: "amount", Message: "maximum withdrawal amount is $100,000.00"}
	}

	// Validate currency
	if r.Currency == "" {
		r.Currency = "USD" // Default to USD
	}

	// Validate withdrawal details based on method
	if r.WithdrawalDetails == nil {
		return &ValidationError{Field: "withdrawal_details", Message: "withdrawal details are required"}
	}

	switch WithdrawalMethod(r.WithdrawalMethod) {
	case WithdrawalMethodTron:
		// Validate Tron wallet address
		walletAddress, ok := r.WithdrawalDetails["wallet_address"].(string)
		if !ok || walletAddress == "" {
			return &ValidationError{Field: "withdrawal_details.wallet_address", Message: "wallet address is required for Tron withdrawals"}
		}
		// Basic Tron address validation (starts with T and 34 characters)
		if len(walletAddress) != 34 || walletAddress[0] != 'T' {
			return &ValidationError{Field: "withdrawal_details.wallet_address", Message: "invalid Tron wallet address format"}
		}

	case WithdrawalMethodBankTransfer, WithdrawalMethodWire:
		// Validate bank details
		accountHolderName, ok := r.WithdrawalDetails["account_holder_name"].(string)
		if !ok || accountHolderName == "" {
			return &ValidationError{Field: "withdrawal_details.account_holder_name", Message: "account holder name is required"}
		}
		
		accountNumber, ok := r.WithdrawalDetails["account_number"].(string)
		if !ok || accountNumber == "" {
			return &ValidationError{Field: "withdrawal_details.account_number", Message: "account number is required"}
		}
		if len(accountNumber) < 8 {
			return &ValidationError{Field: "withdrawal_details.account_number", Message: "account number must be at least 8 characters"}
		}

		routingNumber, ok := r.WithdrawalDetails["routing_number"].(string)
		if !ok || routingNumber == "" {
			return &ValidationError{Field: "withdrawal_details.routing_number", Message: "routing number is required"}
		}
		if len(routingNumber) != 9 {
			return &ValidationError{Field: "withdrawal_details.routing_number", Message: "routing number must be exactly 9 digits"}
		}
	}

	return nil
}

// UpdateWithdrawalStatusRequest represents the request to update withdrawal status
type UpdateWithdrawalStatusRequest struct {
	Status     WithdrawalStatus `json:"status"`                // "approved", "rejected", or "completed"
	AdminNotes *string          `json:"admin_notes,omitempty"` // Optional admin notes
}

// Validate validates the UpdateWithdrawalStatusRequest
func (r *UpdateWithdrawalStatusRequest) Validate() error {
	// Validate status (only approved, rejected, or completed allowed)
	if r.Status != WithdrawalStatusApproved && 
	   r.Status != WithdrawalStatusRejected && 
	   r.Status != WithdrawalStatusCompleted {
		return &ValidationError{
			Field:   "status",
			Message: "status must be 'approved', 'rejected', or 'completed'",
		}
	}
	return nil
}

// WithdrawalNotificationDetails contains details for withdrawal notification emails
type WithdrawalNotificationDetails struct {
	ReferenceID string
	Amount      float64
	FeeAmount   float64
	NetAmount   float64
	Currency    string
	AdminNotes  string
	UserEmail   string
	WithdrawalID uuid.UUID
}

