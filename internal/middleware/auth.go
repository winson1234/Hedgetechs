package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// ContextKey is a type for context keys to avoid collisions
type ContextKey string

const (
	// UserIDKey is the context key for storing the authenticated user ID
	UserIDKey ContextKey = "user_id"
	// UserEmailKey is the context key for storing the authenticated user email
	UserEmailKey ContextKey = "user_email"
)

// SupabaseJWTClaims represents the claims in a Supabase JWT token
type SupabaseJWTClaims struct {
	jwt.RegisteredClaims
	Sub   string `json:"sub"`   // User ID (UUID)
	Email string `json:"email"` // User email
	Role  string `json:"role"`  // User role (e.g., "authenticated")
}

// AuthMiddleware validates the Supabase JWT token and extracts user information
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

		// Validate and parse the JWT token
		userID, email, err := validateSupabaseJWT(tokenString)
		if err != nil {
			log.Printf("JWT validation error: %v", err)
			respondWithError(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}

		// Inject user information into the request context
		ctx := context.WithValue(r.Context(), UserIDKey, userID)
		ctx = context.WithValue(ctx, UserEmailKey, email)

		// Call the next handler with the updated context
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

// validateSupabaseJWT validates a Supabase JWT token and extracts user information
func validateSupabaseJWT(tokenString string) (uuid.UUID, string, error) {
	// Get the JWT secret from environment
	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if jwtSecret == "" {
		return uuid.Nil, "", fmt.Errorf("SUPABASE_JWT_SECRET not set")
	}

	// Parse and validate the token
	token, err := jwt.ParseWithClaims(tokenString, &SupabaseJWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify the signing method is HMAC
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return uuid.Nil, "", fmt.Errorf("failed to parse token: %w", err)
	}

	// Extract and validate claims
	claims, ok := token.Claims.(*SupabaseJWTClaims)
	if !ok || !token.Valid {
		return uuid.Nil, "", fmt.Errorf("invalid token claims")
	}

	// Parse the user ID (UUID from "sub" claim)
	userID, err := uuid.Parse(claims.Sub)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("invalid user ID in token: %w", err)
	}

	// Validate that the user has the authenticated role
	if claims.Role != "authenticated" {
		return uuid.Nil, "", fmt.Errorf("user is not authenticated")
	}

	return userID, claims.Email, nil
}

// GetUserIDFromContext extracts the user ID from the request context
func GetUserIDFromContext(ctx context.Context) (uuid.UUID, error) {
	userID, ok := ctx.Value(UserIDKey).(uuid.UUID)
	if !ok {
		return uuid.Nil, fmt.Errorf("user ID not found in context")
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
				if userID, email, err := validateSupabaseJWT(tokenString); err == nil {
					ctx := context.WithValue(r.Context(), UserIDKey, userID)
					ctx = context.WithValue(ctx, UserEmailKey, email)
					r = r.WithContext(ctx)
				}
			}
		}
		next.ServeHTTP(w, r)
	}
}
