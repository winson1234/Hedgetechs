package models

import (
	"time"

	"github.com/google/uuid"
)

// SavedWithdrawalMethod represents a saved withdrawal method for quick reuse
type SavedWithdrawalMethod struct {
	ID                uuid.UUID               `json:"id"`
	UserID            int64                   `json:"user_id"`
	WithdrawalMethod  WithdrawalMethod        `json:"withdrawal_method"`
	Nickname          *string                 `json:"nickname,omitempty"`
	WithdrawalDetails map[string]interface{}  `json:"withdrawal_details"`
	IsDefault         bool                    `json:"is_default"`
	LastUsedAt        *time.Time              `json:"last_used_at,omitempty"`
	CreatedAt         time.Time               `json:"created_at"`
	UpdatedAt         time.Time               `json:"updated_at"`
}

// GetDisplayName returns a display name for the saved method
func (s *SavedWithdrawalMethod) GetDisplayName() string {
	if s.Nickname != nil && *s.Nickname != "" {
		return *s.Nickname
	}

	// Generate a display name based on the details
	switch s.WithdrawalMethod {
	case WithdrawalMethodTron:
		if addr, ok := s.WithdrawalDetails["wallet_address"].(string); ok && len(addr) >= 10 {
			return "Tron " + addr[:6] + "..." + addr[len(addr)-4:]
		}
		return "Tron Wallet"
	case WithdrawalMethodBankTransfer, WithdrawalMethodWire:
		if last4, ok := s.WithdrawalDetails["account_last4"].(string); ok {
			return "Bank ****" + last4
		}
		if name, ok := s.WithdrawalDetails["account_holder_name"].(string); ok {
			return name + "'s Account"
		}
		return "Bank Account"
	default:
		return string(s.WithdrawalMethod)
	}
}

