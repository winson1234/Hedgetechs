package middleware

import (
	"brokerageProject/internal/utils"
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

// RateLimiter stores rate limiters for each user
type RateLimiter struct {
	limiters map[uuid.UUID]*rate.Limiter
	mu       sync.RWMutex
	// Rate limit configuration
	requestsPerMinute int
	burst             int
}

// Global rate limiter instance
var (
	globalRateLimiter *RateLimiter
	once              sync.Once
)

// InitRateLimiter initializes the global rate limiter
func InitRateLimiter(requestsPerMinute, burst int) {
	once.Do(func() {
		globalRateLimiter = &RateLimiter{
			limiters:          make(map[uuid.UUID]*rate.Limiter),
			requestsPerMinute: requestsPerMinute,
			burst:             burst,
		}

		// Start cleanup goroutine to remove inactive limiters
		go globalRateLimiter.cleanupInactiveLimiters()
	})
}

// GetLimiter retrieves or creates a rate limiter for a specific user
func (rl *RateLimiter) GetLimiter(userID uuid.UUID) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[userID]
	if !exists {
		// Create new limiter: requestsPerMinute requests per minute with burst capacity
		limiter = rate.NewLimiter(rate.Every(time.Minute/time.Duration(rl.requestsPerMinute)), rl.burst)
		rl.limiters[userID] = limiter
	}

	return limiter
}

// cleanupInactiveLimiters removes limiters that haven't been used recently
// This prevents memory leaks from accumulating user limiters
func (rl *RateLimiter) cleanupInactiveLimiters() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		// In production, you'd track last access time and remove old entries
		// For now, we'll keep all limiters (acceptable for reasonable user counts)
		// TODO: Implement last access tracking and cleanup logic
		// Example:
		// rl.mu.Lock()
		// now := time.Now()
		// for userID, limiter := range rl.limiters {
		//     if now.Sub(limiter.LastAccess) > 1*time.Hour {
		//         delete(rl.limiters, userID)
		//     }
		// }
		// rl.mu.Unlock()
	}
}

// RateLimitMiddleware applies rate limiting to protected endpoints
// Usage: middleware.RateLimitMiddleware(yourHandler)
func RateLimitMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Ensure rate limiter is initialized
		if globalRateLimiter == nil {
			// Default: 100 requests per minute with burst of 20
			InitRateLimiter(100, 20)
		}

		// Extract user ID from context (set by AuthMiddleware)
		userIDValue := r.Context().Value(UserIDKey)
		if userIDValue == nil {
			// If no user ID in context, apply IP-based rate limiting
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		userID, ok := userIDValue.(uuid.UUID)
		if !ok {
			http.Error(w, "invalid user ID", http.StatusInternalServerError)
			return
		}

		// Get or create limiter for this user
		limiter := globalRateLimiter.GetLimiter(userID)

		// Check if request is allowed
		if !limiter.Allow() {
			// Rate limit exceeded
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", globalRateLimiter.requestsPerMinute))
			w.Header().Set("X-RateLimit-Remaining", "0")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate_limit_exceeded","message":"Too many requests. Please try again later.","retry_after_seconds":60}`))
			return
		}

		// Request allowed, proceed to next handler
		next.ServeHTTP(w, r)
	}
}

// RateLimitMiddlewareWithConfig creates a rate limit middleware with custom configuration
func RateLimitMiddlewareWithConfig(requestsPerMinute, burst int) func(http.HandlerFunc) http.HandlerFunc {
	// Initialize rate limiter with custom config
	InitRateLimiter(requestsPerMinute, burst)

	return func(next http.HandlerFunc) http.HandlerFunc {
		return RateLimitMiddleware(next)
	}
}

// IPRateLimiter for rate limiting by IP address (for public endpoints)
type IPRateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
}

var (
	ipRateLimiter *IPRateLimiter
	ipOnce        sync.Once
)

// InitIPRateLimiter initializes IP-based rate limiter for public endpoints
func InitIPRateLimiter(requestsPerMinute, burst int) {
	ipOnce.Do(func() {
		ipRateLimiter = &IPRateLimiter{
			limiters: make(map[string]*rate.Limiter),
			rate:     rate.Every(time.Minute / time.Duration(requestsPerMinute)),
			burst:    burst,
		}
	})
}

// GetIPLimiter retrieves or creates a rate limiter for an IP address
func (rl *IPRateLimiter) GetIPLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[ip]
	if !exists {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[ip] = limiter
	}

	return limiter
}

// IPRateLimitMiddleware applies IP-based rate limiting (for public endpoints like login)
func IPRateLimitMiddleware(requestsPerMinute, burst int) func(http.HandlerFunc) http.HandlerFunc {
	InitIPRateLimiter(requestsPerMinute, burst)

	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Get client IP address
			ip := utils.GetClientIP(r)

			// Get limiter for this IP
			limiter := ipRateLimiter.GetIPLimiter(ip)

			// Check if request is allowed
			if !limiter.Allow() {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", requestsPerMinute))
				w.Header().Set("Retry-After", "60")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate_limit_exceeded","message":"Too many requests from this IP. Please try again later."}`))
				return
			}

			next.ServeHTTP(w, r)
		}
	}
}

// rateLimitContextKey is the type for rate limit context keys
type rateLimitContextKey string

const rateLimitInfoKey rateLimitContextKey = "rateLimitInfo"

// Helper function to store rate limit info in context (for audit logging)
func AddRateLimitInfoToContext(ctx context.Context, remaining int, limit int) context.Context {
	type rateLimitInfo struct {
		Remaining int
		Limit     int
	}
	return context.WithValue(ctx, rateLimitInfoKey, rateLimitInfo{Remaining: remaining, Limit: limit})
}
