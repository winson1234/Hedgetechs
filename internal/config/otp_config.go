package config

import "time"

// OTP Configuration Constants
const (
	// OTP TTL - Time to live for OTP codes (2 minutes)
	OTPExpiryDuration = 120 * time.Second

	// OTP Key Prefix - Redis key format: verify:{email}
	OTPKeyPrefix = "verify"

	// Reset Token TTL - Time to live for password reset tokens (15 minutes)
	ResetTokenExpiryDuration = 15 * time.Minute

	// Session Token TTL - Time to live for active sessions (matches JWT expiry)
	// Sessions are invalidated on logout, tab close (frontend), or cache clear
	SessionExpiryDuration = 1 * time.Hour
)

// Rate Limiting Configuration
const (
	// OTP Request Rate Limit
	// Maximum OTP requests per time window
	OTPRequestMaxAttempts = 3
	OTPRequestWindow      = 1 * time.Hour // 3 requests per hour

	// Login Rate Limit
	// Maximum login attempts per time window
	LoginMaxAttempts = 5
	LoginWindow      = 15 * time.Minute // 5 attempts per 15 minutes

	// OTP Verification Rate Limit
	// Maximum OTP verification attempts per time window
	OTPVerifyMaxAttempts = 5
	OTPVerifyWindow      = 5 * time.Minute // 5 attempts per 5 minutes

	// Password Reset Rate Limit
	// Maximum password reset attempts per time window
	PasswordResetMaxAttempts = 3
	PasswordResetWindow      = 1 * time.Hour // 3 attempts per hour
)

// Error Codes for OTP Validation
const (
	ErrorCodeOTPExpired = "OTP_EXPIRED"
	ErrorCodeOTPInvalid = "OTP_INVALID"
	ErrorCodeOTPMissing = "OTP_MISSING"
)

// Rate Limit Action Types
const (
	RateLimitActionForgotPassword = "forgot_password"
	RateLimitActionLogin          = "login"
	RateLimitActionOTPVerify      = "otp_verify"
	RateLimitActionPasswordReset  = "password_reset"
)
