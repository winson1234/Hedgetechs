package models

import (
	"time"
)

// PlatformSetting represents a global configuration setting for the platform
type PlatformSetting struct {
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	Description string    `json:"description,omitempty"`
	UpdatedAt   time.Time `json:"updated_at"`
	UpdatedBy   *int      `json:"updated_by,omitempty"`
}
