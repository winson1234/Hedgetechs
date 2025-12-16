package models

import "github.com/google/uuid"

// UpdateDepositStatusRequest represents the request to update deposit status
type UpdateDepositStatusRequest struct {
	Status     DepositStatus `json:"status"`                // "approved" or "rejected"
	AdminNotes *string       `json:"admin_notes,omitempty"` // Optional admin notes
}

// Validate validates the UpdateDepositStatusRequest
func (r *UpdateDepositStatusRequest) Validate() error {
	// Validate status (only approved or rejected allowed)
	if r.Status != DepositStatusApproved && r.Status != DepositStatusRejected {
		return &ValidationError{Field: "status", Message: "must be 'approved' or 'rejected'"}
	}
	return nil
}

// DepositNotificationDetails contains details for deposit notification emails
type DepositNotificationDetails struct {
	ReferenceID string
	Amount      float64
	Currency    string
	AdminNotes  string
	UserEmail   string
	DepositID   uuid.UUID
}
