package models

import (
	"time"

	"github.com/google/uuid"
)

// AuditLog represents a security audit log entry
type AuditLog struct {
	ID           uuid.UUID              `json:"id"`
	UserID       uuid.UUID              `json:"user_id"`
	Action       string                 `json:"action"` // e.g., "account_created", "transaction_created"
	ResourceType string                 `json:"resource_type"` // e.g., "account", "transaction", "order"
	ResourceID   *uuid.UUID             `json:"resource_id,omitempty"` // ID of the resource acted upon
	IPAddress    *string                `json:"ip_address,omitempty"`
	UserAgent    *string                `json:"user_agent,omitempty"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"` // Additional contextual data
	Status       string                 `json:"status"` // "success" or "failure"
	ErrorMessage *string                `json:"error_message,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
}

// Common audit action constants
const (
	// Account actions
	ActionAccountCreated      = "account_created"
	ActionAccountViewed       = "account_viewed"
	ActionAccountUpdated      = "account_updated"
	ActionAccountMetadataUpdated = "account_metadata_updated"
	ActionAccountDeleted      = "account_deleted"
	ActionAccountSwitched     = "account_switched"

	// Transaction actions
	ActionTransactionCreated  = "transaction_created"
	ActionDepositInitiated    = "deposit_initiated"
	ActionDepositCompleted    = "deposit_completed"
	ActionWithdrawalInitiated = "withdrawal_initiated"
	ActionWithdrawalCompleted = "withdrawal_completed"
	ActionTransferInitiated   = "transfer_initiated"
	ActionTransferCompleted   = "transfer_completed"

	// Order actions
	ActionOrderCreated        = "order_created"
	ActionOrderExecuted       = "order_executed"
	ActionOrderCancelled      = "order_cancelled"
	ActionPendingOrderCreated = "pending_order_created"
	ActionPendingOrderExecuted = "pending_order_executed"
	ActionPendingOrderCancelled = "pending_order_cancelled"

	// Contract actions
	ActionContractOpened      = "contract_opened"
	ActionContractClosed      = "contract_closed"
	ActionContractTPSLUpdated = "contract_tpsl_updated"

	// Authentication actions
	ActionLoginSuccess        = "login_success"
	ActionLoginFailure        = "login_failure"
	ActionLogout              = "logout"
	ActionTokenRefreshed      = "token_refreshed"
	ActionPasswordChanged     = "password_changed"

	// Security events
	ActionRateLimitExceeded   = "rate_limit_exceeded"
	ActionUnauthorizedAccess  = "unauthorized_access"
	ActionSuspiciousActivity  = "suspicious_activity"
)

// Resource type constants
const (
	ResourceTypeAccount     = "account"
	ResourceTypeTransaction = "transaction"
	ResourceTypeOrder       = "order"
	ResourceTypePendingOrder = "pending_order"
	ResourceTypeContract    = "contract"
	ResourceTypeUser        = "user"
)

// Status constants
const (
	AuditStatusSuccess = "success"
	AuditStatusFailure = "failure"
)

// AuditLogEntry is a builder for creating audit logs
type AuditLogEntry struct {
	UserID       uuid.UUID
	Action       string
	ResourceType string
	ResourceID   *uuid.UUID
	IPAddress    *string
	UserAgent    *string
	Metadata     map[string]interface{}
	Status       string
	ErrorMessage *string
}

// NewAuditLogEntry creates a new audit log entry builder
func NewAuditLogEntry(userID uuid.UUID, action, resourceType string) *AuditLogEntry {
	return &AuditLogEntry{
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		Status:       AuditStatusSuccess,
		Metadata:     make(map[string]interface{}),
	}
}

// WithResourceID adds a resource ID to the audit log
func (a *AuditLogEntry) WithResourceID(resourceID uuid.UUID) *AuditLogEntry {
	a.ResourceID = &resourceID
	return a
}

// WithIPAddress adds an IP address to the audit log
func (a *AuditLogEntry) WithIPAddress(ip string) *AuditLogEntry {
	a.IPAddress = &ip
	return a
}

// WithUserAgent adds a user agent to the audit log
func (a *AuditLogEntry) WithUserAgent(ua string) *AuditLogEntry {
	a.UserAgent = &ua
	return a
}

// WithMetadata adds metadata to the audit log
func (a *AuditLogEntry) WithMetadata(key string, value interface{}) *AuditLogEntry {
	a.Metadata[key] = value
	return a
}

// WithFailure marks the audit log as a failure with an error message
func (a *AuditLogEntry) WithFailure(errorMessage string) *AuditLogEntry {
	a.Status = AuditStatusFailure
	a.ErrorMessage = &errorMessage
	return a
}
