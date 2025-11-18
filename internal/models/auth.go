package models

import "github.com/google/uuid"

// RegisterRequest represents the registration request payload
type RegisterRequest struct {
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	PhoneNumber string `json:"phone_number"`
	Country     string `json:"country"`
}

// LoginRequest represents the login request payload
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// CheckStatusRequest represents the check status request payload
type CheckStatusRequest struct {
	Email string `json:"email"`
}

// LoginResponse represents the login response
type LoginResponse struct {
	Token   string      `json:"token,omitempty"`
	User    *UserInfo   `json:"user,omitempty"`
	Message string      `json:"message"`
	Status  string      `json:"status"` // pending, approved, rejected
}

// CheckStatusResponse represents the registration status check response
type CheckStatusResponse struct {
	Status  string `json:"status"` // pending, approved, rejected, not_found
	Message string `json:"message"`
}

// UserInfo represents user information returned after login
type UserInfo struct {
	ID          uuid.UUID `json:"id"`
	UserID      string    `json:"user_id"`
	Email       string    `json:"email"`
	FirstName   string    `json:"first_name,omitempty"`
	LastName    string    `json:"last_name,omitempty"`
	PhoneNumber string    `json:"phone_number,omitempty"`
	Country     string    `json:"country,omitempty"`
	IsActive    bool      `json:"is_active"`
}

// RegisterResponse represents the registration response
type RegisterResponse struct {
	Message string `json:"message"`
	Success bool   `json:"success"`
}
