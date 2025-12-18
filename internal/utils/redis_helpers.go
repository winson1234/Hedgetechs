package utils

import (
	"context"
	"fmt"
	"time"

	"brokerageProject/internal/config"

	"github.com/redis/go-redis/v9"
)

// RedisKeyBuilder provides helper methods for building Redis keys
type RedisKeyBuilder struct{}

// NewRedisKeyBuilder creates a new RedisKeyBuilder
func NewRedisKeyBuilder() *RedisKeyBuilder {
	return &RedisKeyBuilder{}
}

// OTPKey builds the OTP key for a given email
// Format: verify:{email}
func (b *RedisKeyBuilder) OTPKey(email string) string {
	return fmt.Sprintf("%s:%s", config.OTPKeyPrefix, email)
}

// ResetTokenKey builds the reset token key
// Format: auth:reset:{token}
func (b *RedisKeyBuilder) ResetTokenKey(token string) string {
	return fmt.Sprintf("auth:reset:%s", token)
}

// RateLimitKey builds the rate limit key
// Format: ratelimit:{action}:{identifier}
func (b *RedisKeyBuilder) RateLimitKey(action, identifier string) string {
	return fmt.Sprintf("ratelimit:%s:%s", action, identifier)
}

// SessionRevocationKey builds the session revocation key
// Format: auth:revocation:{userUUID}
func (b *RedisKeyBuilder) SessionRevocationKey(userUUID string) string {
	return fmt.Sprintf("auth:revocation:%s", userUUID)
}

// RedisOTPHelper provides utility methods for OTP operations
type RedisOTPHelper struct {
	client *redis.Client
}

// NewRedisOTPHelper creates a new RedisOTPHelper
func NewRedisOTPHelper(client *redis.Client) *RedisOTPHelper {
	return &RedisOTPHelper{client: client}
}

// GetAllOTPKeys returns all OTP keys matching the pattern verify:*
// Useful for debugging and monitoring
func (h *RedisOTPHelper) GetAllOTPKeys(ctx context.Context) ([]string, error) {
	pattern := fmt.Sprintf("%s:*", config.OTPKeyPrefix)
	keys, err := h.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get OTP keys: %w", err)
	}
	return keys, nil
}

// GetOTPWithTTL returns the OTP value and remaining TTL for a given email
// Returns (otp, ttl, error)
func (h *RedisOTPHelper) GetOTPWithTTL(ctx context.Context, email string) (string, time.Duration, error) {
	keyBuilder := NewRedisKeyBuilder()
	key := keyBuilder.OTPKey(email)

	// Get OTP value
	otp, err := h.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", 0, fmt.Errorf("OTP not found or expired")
	}
	if err != nil {
		return "", 0, fmt.Errorf("failed to get OTP: %w", err)
	}

	// Get TTL
	ttl, err := h.client.TTL(ctx, key).Result()
	if err != nil {
		return "", 0, fmt.Errorf("failed to get TTL: %w", err)
	}

	return otp, ttl, nil
}

// DeleteAllOTPKeys deletes all OTP keys (useful for testing/cleanup)
func (h *RedisOTPHelper) DeleteAllOTPKeys(ctx context.Context) (int64, error) {
	keys, err := h.GetAllOTPKeys(ctx)
	if err != nil {
		return 0, err
	}

	if len(keys) == 0 {
		return 0, nil
	}

	deleted, err := h.client.Del(ctx, keys...).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to delete OTP keys: %w", err)
	}

	return deleted, nil
}

// RedisRateLimitHelper provides utility methods for rate limit operations
type RedisRateLimitHelper struct {
	client *redis.Client
}

// NewRedisRateLimitHelper creates a new RedisRateLimitHelper
func NewRedisRateLimitHelper(client *redis.Client) *RedisRateLimitHelper {
	return &RedisRateLimitHelper{client: client}
}

// GetAllRateLimitKeys returns all rate limit keys matching the pattern ratelimit:*
// Useful for debugging and monitoring
func (h *RedisRateLimitHelper) GetAllRateLimitKeys(ctx context.Context) ([]string, error) {
	keys, err := h.client.Keys(ctx, "ratelimit:*").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get rate limit keys: %w", err)
	}
	return keys, nil
}

// GetRateLimitInfo returns the current count and TTL for a rate limit key
// Returns (count, ttl, error)
func (h *RedisRateLimitHelper) GetRateLimitInfo(ctx context.Context, action, identifier string) (int64, time.Duration, error) {
	keyBuilder := NewRedisKeyBuilder()
	key := keyBuilder.RateLimitKey(action, identifier)

	// Get count
	count, err := h.client.Get(ctx, key).Int64()
	if err == redis.Nil {
		return 0, 0, nil // No rate limit set yet
	}
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get rate limit count: %w", err)
	}

	// Get TTL
	ttl, err := h.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, 0, fmt.Errorf("failed to get TTL: %w", err)
	}

	return count, ttl, nil
}

// DeleteAllRateLimitKeys deletes all rate limit keys (useful for testing/cleanup)
func (h *RedisRateLimitHelper) DeleteAllRateLimitKeys(ctx context.Context) (int64, error) {
	keys, err := h.GetAllRateLimitKeys(ctx)
	if err != nil {
		return 0, err
	}

	if len(keys) == 0 {
		return 0, nil
	}

	deleted, err := h.client.Del(ctx, keys...).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to delete rate limit keys: %w", err)
	}

	return deleted, nil
}

// DeleteRateLimitKey deletes a specific rate limit key
func (h *RedisRateLimitHelper) DeleteRateLimitKey(ctx context.Context, action, identifier string) error {
	keyBuilder := NewRedisKeyBuilder()
	key := keyBuilder.RateLimitKey(action, identifier)
	return h.client.Del(ctx, key).Err()
}

// RedisSessionHelper provides utility methods for session operations
type RedisSessionHelper struct {
	client *redis.Client
}

// NewRedisSessionHelper creates a new RedisSessionHelper
func NewRedisSessionHelper(client *redis.Client) *RedisSessionHelper {
	return &RedisSessionHelper{client: client}
}

// GetAllSessionKeys returns all session keys for a specific user or all users
// Pattern: session:{userUUID}:* for specific user, session:* for all
func (h *RedisSessionHelper) GetAllSessionKeys(ctx context.Context, userUUID string) ([]string, error) {
	var pattern string
	if userUUID != "" {
		pattern = fmt.Sprintf("session:%s:*", userUUID)
	} else {
		pattern = "session:*"
	}
	
	keys, err := h.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get session keys: %w", err)
	}
	return keys, nil
}

// GetSessionInfo returns session information including TTL
// Returns (sessionData, ttl, error)
func (h *RedisSessionHelper) GetSessionInfo(ctx context.Context, userUUID, sessionID string) (string, time.Duration, error) {
	key := fmt.Sprintf("session:%s:%s", userUUID, sessionID)
	
	// Get session data
	data, err := h.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", 0, fmt.Errorf("session not found")
	}
	if err != nil {
		return "", 0, fmt.Errorf("failed to get session: %w", err)
	}
	
	// Get TTL
	ttl, err := h.client.TTL(ctx, key).Result()
	if err != nil {
		return "", 0, fmt.Errorf("failed to get TTL: %w", err)
	}
	
	return data, ttl, nil
}

// DeleteAllSessions deletes all sessions (useful for testing/cleanup)
func (h *RedisSessionHelper) DeleteAllSessions(ctx context.Context) (int64, error) {
	keys, err := h.GetAllSessionKeys(ctx, "")
	if err != nil {
		return 0, err
	}
	
	if len(keys) == 0 {
		return 0, nil
	}
	
	deleted, err := h.client.Del(ctx, keys...).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to delete sessions: %w", err)
	}
	
	return deleted, nil
}

// CountUserSessions returns the number of active sessions for a user
func (h *RedisSessionHelper) CountUserSessions(ctx context.Context, userUUID string) (int, error) {
	keys, err := h.GetAllSessionKeys(ctx, userUUID)
	if err != nil {
		return 0, err
	}
	return len(keys), nil
}
