package middleware

import (
	"brokerageProject/internal/database"
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

// AuthMiddleware validates the custom JWT token and extracts user information
// It requires the Authorization header with format: "Bearer <jwt_token>"
// On success, it injects the user_id and email into the request context
func AuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
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

		// Look up bigint user_id from users table (for backward compatibility with admin panel)
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

		// Inject user information and request metadata into the request context
		// Store bigint user_id for database queries (backward compatibility)
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
