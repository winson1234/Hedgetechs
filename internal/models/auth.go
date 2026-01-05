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
	UserType    string `json:"user_type"` // "trader" or "agent"
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
	Token   string    `json:"token,omitempty"`
	User    *UserInfo `json:"user,omitempty"`
	Message string    `json:"message"`
	Status  string    `json:"status"` // pending, approved, rejected
}

// CheckStatusResponse represents the registration status check response
type CheckStatusResponse struct {
	Status  string `json:"status"` // pending, approved, rejected, not_found
	Message string `json:"message"`
}

// UserInfo represents user information returned after login
type UserInfo struct {
	KeycloakID  uuid.UUID `json:"keycloak_id"`
	UserID      int64     `json:"user_id"`
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

// ForgotPasswordRequest represents the forgot password request payload
type ForgotPasswordRequest struct {
	Email string `json:"email"`
}

// ForgotPasswordResponse represents the forgot password response
type ForgotPasswordResponse struct {
	Message string `json:"message"`
	Status  string `json:"status"` // success, pending, rejected, not_found
	Success bool   `json:"success"`
	OTP     string `json:"otp,omitempty"` // Only included in development mode
}

// VerifyOTPRequest represents the OTP verification request payload
type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

// VerifyOTPResponse represents the OTP verification response
type VerifyOTPResponse struct {
	Message    string `json:"message"`
	Success    bool   `json:"success"`
	ResetToken string `json:"reset_token,omitempty"`
}

// ResetPasswordRequest represents the reset password request payload
type ResetPasswordRequest struct {
	Email       string `json:"email"`
	ResetToken  string `json:"reset_token"`
	NewPassword string `json:"new_password"`
}

// ResetPasswordResponse represents the reset password response
type ResetPasswordResponse struct {
	Message string `json:"message"`
	Success bool   `json:"success"`
}

// ChangePasswordRequest represents the change password request payload for authenticated users
type ChangePasswordRequest struct {
	CurrentPassword  string `json:"current_password"`
	NewPassword      string `json:"new_password"`
	LogoutAllDevices bool   `json:"logout_all_devices"`
}
