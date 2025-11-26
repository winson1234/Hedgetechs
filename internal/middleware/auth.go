package middleware

import (
	"brokerageProject/internal/database"
	"brokerageProject/internal/services"
	"brokerageProject/internal/utils"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/google/uuid"
)

// ContextKey is a type for context keys to avoid collisions
type ContextKey string

const (
	// UserIDKey is the context key for storing the authenticated user ID
	UserIDKey ContextKey = "user_id"
	// UserEmailKey is the context key for storing the authenticated user email
	UserEmailKey ContextKey = "user_email"
	// IPAddressKey is the context key for storing the client IP address
	IPAddressKey ContextKey = "ip_address"
	// UserAgentKey is the context key for storing the client user agent
	UserAgentKey ContextKey = "user_agent"
)

// NewAuthMiddleware creates a middleware factory with dependency injection for session revocation
// This factory pattern allows us to inject AuthStorageService without using global variables
func NewAuthMiddleware(authStorage *services.AuthStorageService) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// Get the Authorization header
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				respondWithError(w, http.StatusUnauthorized, "missing authorization header")
				return
			}

			// Extract the token (format: "Bearer <token>")
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				respondWithError(w, http.StatusUnauthorized, "invalid authorization header format")
				return
			}

			tokenString := parts[1]
			if tokenString == "" {
				respondWithError(w, http.StatusUnauthorized, "missing token")
				return
			}

			// Validate and parse the JWT token using custom JWT validator
			claims, err := utils.ValidateJWT(tokenString)
			if err != nil {
				log.Printf("JWT validation error: %v", err)
				respondWithError(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			// Parse user UUID from claims
			userUUID, err := uuid.Parse(claims.UserID)
			if err != nil {
				log.Printf("Invalid user ID in token: %v", err)
				respondWithError(w, http.StatusUnauthorized, "invalid user ID in token")
				return
			}

			// CRITICAL: Check session revocation (Kill Switch)
			// If password was changed after this token was issued, reject it
			// NOTE: This feature requires Redis. If Redis is unavailable, skip the check (fail-open for availability)
			if authStorage != nil {
				tokenIssuedAt := claims.IssuedAt.Unix()
				isRevoked, err := authStorage.IsSessionRevoked(r.Context(), userUUID.String(), tokenIssuedAt)
				if err != nil {
					// Log error but don't fail the request (fail open for availability)
					log.Printf("[AUTH ERROR] Failed to check session revocation for user %s: %v", userUUID, err)
				}
				if isRevoked {
					respondWithJSON(w, http.StatusUnauthorized, map[string]interface{}{
						"error":   "session_revoked",
						"message": "Your session was invalidated due to a security update. Please log in again.",
					})
					return
				}
			}
			// If authStorage is nil, session revocation is disabled (logged at startup)

			// Look up bigint user_id from users table
			pool, err := database.GetPool()
			if err != nil {
				log.Printf("Database pool error: %v", err)
				respondWithError(w, http.StatusInternalServerError, "database connection error")
				return
			}

			var userBigIntID int64
			err = pool.QueryRow(r.Context(), "SELECT user_id FROM users WHERE id = $1", userUUID).Scan(&userBigIntID)
			if err != nil {
				log.Printf("Failed to lookup user_id for UUID %s: %v", userUUID, err)
				respondWithError(w, http.StatusUnauthorized, "user not found")
				return
			}

			// Extract IP address and user agent from request
			ipAddress := utils.GetClientIP(r)
			userAgent := r.UserAgent()

			// Inject bigint user_id into the request context
			ctx := context.WithValue(r.Context(), UserIDKey, userBigIntID)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
			ctx = context.WithValue(ctx, IPAddressKey, ipAddress)
			ctx = context.WithValue(ctx, UserAgentKey, userAgent)

			// Call the next handler with the updated context
			next.ServeHTTP(w, r.WithContext(ctx))
		}
	}
}

// AuthMiddleware is the legacy function signature kept for backward compatibility
// DEPRECATED: Use NewAuthMiddleware instead for proper dependency injection
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	log.Println("[WARN] Using deprecated AuthMiddleware without session revocation check. Use NewAuthMiddleware instead.")
	return func(w http.ResponseWriter, r *http.Request) {
		// Get the Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			respondWithError(w, http.StatusUnauthorized, "missing authorization header")
			return
		}

		// Extract the token (format: "Bearer <token>")
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			respondWithError(w, http.StatusUnauthorized, "invalid authorization header format")
			return
		}

		tokenString := parts[1]
		if tokenString == "" {
			respondWithError(w, http.StatusUnauthorized, "missing token")
			return
		}

		// Validate and parse the JWT token using custom JWT validator
		claims, err := utils.ValidateJWT(tokenString)
		if err != nil {
			log.Printf("JWT validation error: %v", err)
			respondWithError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		// Parse user UUID from claims
		userUUID, err := uuid.Parse(claims.UserID)
		if err != nil {
			log.Printf("Invalid user ID in token: %v", err)
			respondWithError(w, http.StatusUnauthorized, "invalid user ID in token")
			return
		}

		// Look up bigint user_id from users table
		pool, err := database.GetPool()
		if err != nil {
			log.Printf("Database pool error: %v", err)
			respondWithError(w, http.StatusInternalServerError, "database connection error")
			return
		}

		var userBigIntID int64
		err = pool.QueryRow(r.Context(), "SELECT user_id FROM users WHERE id = $1", userUUID).Scan(&userBigIntID)
		if err != nil {
			log.Printf("Failed to lookup user_id for UUID %s: %v", userUUID, err)
			respondWithError(w, http.StatusUnauthorized, "user not found")
			return
		}

		// Extract IP address and user agent from request
		ipAddress := utils.GetClientIP(r)
		userAgent := r.UserAgent()

		// Inject bigint user_id into the request context
		ctx := context.WithValue(r.Context(), UserIDKey, userBigIntID)
		ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
		ctx = context.WithValue(ctx, IPAddressKey, ipAddress)
		ctx = context.WithValue(ctx, UserAgentKey, userAgent)

		// Call the next handler with the updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// GetUserIDFromContext extracts the user ID (bigint) from the request context
func GetUserIDFromContext(ctx context.Context) (int64, error) {
	userID, ok := ctx.Value(UserIDKey).(int64)
	if !ok {
		return 0, fmt.Errorf("user ID not found in context")
	}
	return userID, nil
}

// GetUserEmailFromContext extracts the user email from the request context
func GetUserEmailFromContext(ctx context.Context) (string, error) {
	email, ok := ctx.Value(UserEmailKey).(string)
	if !ok {
		return "", fmt.Errorf("user email not found in context")
	}
	return email, nil
}

// GetIPAddressFromContext extracts the IP address from the request context
func GetIPAddressFromContext(ctx context.Context) (string, error) {
	ipAddress, ok := ctx.Value(IPAddressKey).(string)
	if !ok {
		return "", fmt.Errorf("IP address not found in context")
	}
	return ipAddress, nil
}

// GetUserAgentFromContext extracts the user agent from the request context
func GetUserAgentFromContext(ctx context.Context) (string, error) {
	userAgent, ok := ctx.Value(UserAgentKey).(string)
	if !ok {
		return "", fmt.Errorf("user agent not found in context")
	}
	return userAgent, nil
}

// respondWithError sends a JSON error response
func respondWithError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   true,
		"message": message,
		"code":    statusCode,
	})
}

// respondWithJSON sends a custom JSON response
func respondWithJSON(w http.ResponseWriter, statusCode int, payload map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(payload)
}

// OptionalAuthMiddleware is like AuthMiddleware but doesn't require authentication
// If a valid token is provided, it injects user info into context
// If no token or invalid token, it proceeds without user info
func OptionalAuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString := parts[1]
				if claims, err := utils.ValidateJWT(tokenString); err == nil {
					if userUUID, parseErr := uuid.Parse(claims.UserID); parseErr == nil {
						// Look up bigint user_id from users table
						if pool, dbErr := database.GetPool(); dbErr == nil {
							var userBigIntID int64
							if scanErr := pool.QueryRow(r.Context(), "SELECT user_id FROM users WHERE id = $1", userUUID).Scan(&userBigIntID); scanErr == nil {
								ctx := context.WithValue(r.Context(), UserIDKey, userBigIntID)
								ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
								r = r.WithContext(ctx)
							}
						}
					}
				}
			}
		}
		next.ServeHTTP(w, r)
	}
}
