package models

import (
	"time"

	"github.com/google/uuid"
)

// Notification represents a user notification
type Notification struct {
	ID        uuid.UUID              `json:"id"`
	UserID    int64                  `json:"user_id"`
	Type      string                 `json:"type"` // e.g., "transfer", "deposit", "withdrawal", "order", "system"
	Title     string                 `json:"title"`
	Message   string                 `json:"message"`
	IsRead    bool                   `json:"is_read"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	ReadAt    *time.Time             `json:"read_at,omitempty"`
}

// Notification types
const (
	NotificationTypeTransfer   = "transfer"
	NotificationTypeDeposit    = "deposit"
	NotificationTypeWithdrawal = "withdrawal"
	NotificationTypeOrder      = "order"
	NotificationTypeSystem     = "system"
)

