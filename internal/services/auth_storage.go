package services

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"brokerageProject/internal/config"

	"github.com/redis/go-redis/v9"
)

// AuthStorageService handles all temporary authentication state in Redis
type AuthStorageService struct {
	client *redis.Client
}

// NewAuthStorageService creates a new auth storage service
func NewAuthStorageService(client *redis.Client) *AuthStorageService {
	return &AuthStorageService{
		client: client,
	}
}

// ============================================================================
// OTP Management
// ============================================================================

// StoreOTP stores an OTP code for the given email with 120 second (2 minute) TTL
// Key format: verify:{email}
// This key will automatically expire after the TTL, cleaning up stale OTPs
func (s *AuthStorageService) StoreOTP(ctx context.Context, email, otp string) error {
	key := fmt.Sprintf("%s:%s", config.OTPKeyPrefix, email)
	ttl := config.OTPExpiryDuration

	err := s.client.Set(ctx, key, otp, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to store OTP: %w", err)
	}

	return nil
}

// OTPValidationResult represents the result of OTP validation
type OTPValidationResult struct {
	Valid     bool
	ErrorCode string // OTP_EXPIRED, OTP_INVALID, OTP_MISSING
}

// ValidateOTP validates the OTP for the given email and deletes it immediately on success.
// Uses a Lua script to ensure atomicity and prevent race conditions (replay attacks).
// This ensures one-time use even under concurrent requests.
// Returns OTPValidationResult with appropriate error code
func (s *AuthStorageService) ValidateOTP(ctx context.Context, email, otp string) bool {
	key := fmt.Sprintf("%s:%s", config.OTPKeyPrefix, email)

	// Execute Lua script: Check value and delete in one atomic step
	// Result is 1 (success/deleted) or 0 (failure/not found/mismatch)
	result, err := validateOTPScript.Run(ctx, s.client, []string{key}, otp).Int()
	if err != nil {
		// Log error if needed, but return false safely
		return false
	}

	return result == 1
}

// ValidateOTPWithDetails validates the OTP and returns detailed error information
// This includes whether the OTP is expired, invalid, or missing
func (s *AuthStorageService) ValidateOTPWithDetails(ctx context.Context, email, otp string) OTPValidationResult {
	key := fmt.Sprintf("%s:%s", config.OTPKeyPrefix, email)

	// First check if key exists
	exists, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return OTPValidationResult{Valid: false, ErrorCode: config.ErrorCodeOTPInvalid}
	}

	// If key doesn't exist, it's either expired or was never created
	if exists == 0 {
		return OTPValidationResult{Valid: false, ErrorCode: config.ErrorCodeOTPExpired}
	}

	// Key exists, now validate the value atomically and delete if valid
	result, err := validateOTPScript.Run(ctx, s.client, []string{key}, otp).Int()
	if err != nil {
		return OTPValidationResult{Valid: false, ErrorCode: config.ErrorCodeOTPInvalid}
	}

	if result == 1 {
		return OTPValidationResult{Valid: true, ErrorCode: ""}
	}

	// OTP exists but doesn't match - invalid OTP
	return OTPValidationResult{Valid: false, ErrorCode: config.ErrorCodeOTPInvalid}
}

// CheckOTPExists checks if an OTP exists for the given email (without validating or deleting it)
// Useful for checking if an OTP has expired
func (s *AuthStorageService) CheckOTPExists(ctx context.Context, email string) (bool, error) {
	key := fmt.Sprintf("%s:%s", config.OTPKeyPrefix, email)
	exists, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check OTP existence: %w", err)
	}
	return exists > 0, nil
}

// GetOTPTTL returns the remaining TTL for an OTP
// Returns -1 if key doesn't exist, -2 if key exists but has no TTL
func (s *AuthStorageService) GetOTPTTL(ctx context.Context, email string) (time.Duration, error) {
	key := fmt.Sprintf("%s:%s", config.OTPKeyPrefix, email)
	ttl, err := s.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get OTP TTL: %w", err)
	}
	return ttl, nil
}

// DeleteOTP manually deletes an OTP (for cleanup if needed)
func (s *AuthStorageService) DeleteOTP(ctx context.Context, email string) error {
	key := fmt.Sprintf("%s:%s", config.OTPKeyPrefix, email)
	return s.client.Del(ctx, key).Err()
}

// ============================================================================
// Reset Token Management
// ============================================================================

// StoreResetToken stores a reset token with the associated email with configurable TTL
// Key format: auth:reset:{token}
// Default TTL: 15 minutes
func (s *AuthStorageService) StoreResetToken(ctx context.Context, token, email string) error {
	key := fmt.Sprintf("auth:reset:%s", token)
	ttl := config.ResetTokenExpiryDuration

	err := s.client.Set(ctx, key, email, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to store reset token: %w", err)
	}

	return nil
}

// ValidateResetToken validates the reset token and returns the associated email.
// Uses a Lua script to ensure atomicity and prevent race conditions.
// Deletes the token immediately on success to ensure one-time use.
func (s *AuthStorageService) ValidateResetToken(ctx context.Context, token string) (string, error) {
	key := fmt.Sprintf("auth:reset:%s", token)

	// Execute Lua script: Get email and delete token in one atomic step
	// Returns the email if token is valid, empty string otherwise
	result, err := validateResetTokenScript.Run(ctx, s.client, []string{key}).Result()
	if err != nil {
		return "", fmt.Errorf("invalid or expired reset token")
	}

	email, ok := result.(string)
	if !ok || email == "" {
		return "", fmt.Errorf("invalid or expired reset token")
	}

	return email, nil
}

// DeleteResetToken manually deletes a reset token (for cleanup if needed)
func (s *AuthStorageService) DeleteResetToken(ctx context.Context, token string) error {
	key := fmt.Sprintf("auth:reset:%s", token)
	return s.client.Del(ctx, key).Err()
}

// ============================================================================
// Rate Limiting (Token Bucket with Lua Script for Atomicity)
// ============================================================================

// Lua script for atomic INCR + EXPIRE
// This prevents "zombie keys" with infinite TTL if the app crashes between INCR and EXPIRE
var rateLimitScript = redis.NewScript(`
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local count = redis.call('INCR', key)
if count == 1 then
    redis.call('EXPIRE', key, ttl)
end
return count
`)

// Lua script for atomic OTP validation (check and delete)
// Prevents race conditions and replay attacks by ensuring atomicity
// Returns 1 if matched and deleted, 0 otherwise
var validateOTPScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end
`)

// Lua script for atomic reset token validation (get and delete)
// Prevents race conditions by ensuring atomicity
// Returns the email if token is valid, empty string otherwise
var validateResetTokenScript = redis.NewScript(`
local email = redis.call("GET", KEYS[1])
if email then
    redis.call("DEL", KEYS[1])
    return email
else
    return ""
end
`)

// CheckRateLimit checks if the action is allowed based on rate limiting rules
// Returns (allowed bool, remaining attempts int, error)
// Key format: ratelimit:{action}:{identifier}
func (s *AuthStorageService) CheckRateLimit(ctx context.Context, action, identifier string, maxAttempts int, window time.Duration) (bool, int, error) {
	key := fmt.Sprintf("ratelimit:%s:%s", action, identifier)
	ttlSeconds := int(window.Seconds())

	// Execute Lua script for atomic INCR + EXPIRE
	result, err := rateLimitScript.Run(ctx, s.client, []string{key}, ttlSeconds).Result()
	if err != nil {
		return false, 0, fmt.Errorf("failed to check rate limit: %w", err)
	}

	count, ok := result.(int64)
	if !ok {
		return false, 0, fmt.Errorf("unexpected result type from rate limit script")
	}

	remaining := maxAttempts - int(count)
	if remaining < 0 {
		remaining = 0
	}

	allowed := count <= int64(maxAttempts)
	return allowed, remaining, nil
}

// GetRateLimitInfo returns the current rate limit info without incrementing
// Useful for checking current state without consuming an attempt
func (s *AuthStorageService) GetRateLimitInfo(ctx context.Context, action, identifier string, maxAttempts int) (remaining int, ttl time.Duration, err error) {
	key := fmt.Sprintf("ratelimit:%s:%s", action, identifier)

	// Get current count
	countStr, err := s.client.Get(ctx, key).Result()
	if err == redis.Nil {
		// No attempts yet
		return maxAttempts, 0, nil
	}
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get rate limit info: %w", err)
	}

	count, err := strconv.Atoi(countStr)
	if err != nil {
		return 0, 0, fmt.Errorf("invalid count value: %w", err)
	}

	// Get TTL
	ttlDuration, err := s.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get TTL: %w", err)
	}

	remaining = maxAttempts - count
	if remaining < 0 {
		remaining = 0
	}

	return remaining, ttlDuration, nil
}

// ResetRateLimit manually resets the rate limit for a specific action/identifier
// Useful for admin operations or testing
func (s *AuthStorageService) ResetRateLimit(ctx context.Context, action, identifier string) error {
	key := fmt.Sprintf("ratelimit:%s:%s", action, identifier)
	return s.client.Del(ctx, key).Err()
}

// ============================================================================
// Session Revocation (Kill Switch)
// ============================================================================

// RevokeSessions stores the current timestamp for the given user UUID
// Any JWT issued before this timestamp will be rejected by the middleware
// Key format: auth:revocation:{userUUID}
// TTL: 24 hours (matches JWT expiry)
func (s *AuthStorageService) RevokeSessions(ctx context.Context, userUUID string) error {
	key := fmt.Sprintf("auth:revocation:%s", userUUID)
	timestamp := time.Now().Unix()
	ttl := 24 * time.Hour

	err := s.client.Set(ctx, key, timestamp, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to revoke sessions: %w", err)
	}

	return nil
}

// IsSessionRevoked checks if a JWT token has been revoked
// Returns true if the token's IssuedAt time is before the revocation timestamp
func (s *AuthStorageService) IsSessionRevoked(ctx context.Context, userUUID string, tokenIssuedAt int64) (bool, error) {
	key := fmt.Sprintf("auth:revocation:%s", userUUID)

	// Get revocation timestamp
	revocationTimestampStr, err := s.client.Get(ctx, key).Result()
	if err == redis.Nil {
		// No revocation timestamp exists - session is valid
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check session revocation: %w", err)
	}

	revocationTimestamp, err := strconv.ParseInt(revocationTimestampStr, 10, 64)
	if err != nil {
		return false, fmt.Errorf("invalid revocation timestamp: %w", err)
	}

	// Token is revoked if it was issued before the revocation timestamp
	isRevoked := tokenIssuedAt < revocationTimestamp
	return isRevoked, nil
}

// ClearRevocation manually clears the revocation timestamp for a user
// Useful for admin operations or testing
func (s *AuthStorageService) ClearRevocation(ctx context.Context, userUUID string) error {
	key := fmt.Sprintf("auth:revocation:%s", userUUID)
	return s.client.Del(ctx, key).Err()
}

// ============================================================================
// Session Token Management (Active Session Tracking)
// ============================================================================

// StoreSession stores an active session token for the given user
// Key format: session:{userUUID}:{sessionID}
// TTL: 24 hours (matches JWT expiry)
// Sessions are invalidated on logout, tab close, or cache clear
func (s *AuthStorageService) StoreSession(ctx context.Context, userUUID, sessionID string) error {
	key := fmt.Sprintf("session:%s:%s", userUUID, sessionID)
	ttl := config.SessionExpiryDuration
	
	// Store session metadata (timestamp when session was created)
	sessionData := time.Now().Unix()
	
	err := s.client.Set(ctx, key, sessionData, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to store session: %w", err)
	}
	
	return nil
}

// ValidateSession checks if a session token is valid
// Returns true if session exists in Redis, false otherwise
func (s *AuthStorageService) ValidateSession(ctx context.Context, userUUID, sessionID string) (bool, error) {
	key := fmt.Sprintf("session:%s:%s", userUUID, sessionID)
	
	exists, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check session: %w", err)
	}
	
	return exists > 0, nil
}

// DeleteSession removes a specific session (used on logout)
func (s *AuthStorageService) DeleteSession(ctx context.Context, userUUID, sessionID string) error {
	key := fmt.Sprintf("session:%s:%s", userUUID, sessionID)
	return s.client.Del(ctx, key).Err()
}

// DeleteAllUserSessions removes all sessions for a specific user
// Useful for "logout from all devices" functionality
func (s *AuthStorageService) DeleteAllUserSessions(ctx context.Context, userUUID string) (int64, error) {
	pattern := fmt.Sprintf("session:%s:*", userUUID)
	
	// Get all session keys for this user
	keys, err := s.client.Keys(ctx, pattern).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get session keys: %w", err)
	}
	
	if len(keys) == 0 {
		return 0, nil
	}
	
	// Delete all session keys
	deleted, err := s.client.Del(ctx, keys...).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to delete sessions: %w", err)
	}
	
	return deleted, nil
}

// GetUserSessionCount returns the number of active sessions for a user
func (s *AuthStorageService) GetUserSessionCount(ctx context.Context, userUUID string) (int, error) {
	pattern := fmt.Sprintf("session:%s:*", userUUID)
	
	keys, err := s.client.Keys(ctx, pattern).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get session keys: %w", err)
	}
	
	return len(keys), nil
}

// RefreshSession extends the TTL of an existing session
// Useful for "remember me" or activity-based session extension
func (s *AuthStorageService) RefreshSession(ctx context.Context, userUUID, sessionID string) error {
	key := fmt.Sprintf("session:%s:%s", userUUID, sessionID)
	ttl := config.SessionExpiryDuration
	
	// Check if session exists
	exists, err := s.client.Exists(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("failed to check session: %w", err)
	}
	
	if exists == 0 {
		return fmt.Errorf("session not found")
	}
	
	// Extend TTL
	err = s.client.Expire(ctx, key, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to refresh session: %w", err)
	}
	
	return nil
}
