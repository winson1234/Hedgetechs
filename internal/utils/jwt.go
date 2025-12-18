package utils

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// CustomClaims represents the JWT claims structure
type CustomClaims struct {
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	SessionID string `json:"session_id"` // Session ID for tracking active sessions in Redis
	jwt.RegisteredClaims
}

// GenerateJWT creates a new JWT token for the user with a unique session ID
func GenerateJWT(userID uuid.UUID, email string) (string, string, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return "", "", errors.New("JWT_SECRET environment variable not set")
	}

	// Get expiry hours from env or default to 24 hours
	expiryHours := 24
	if envExpiry := os.Getenv("JWT_EXPIRY_HOURS"); envExpiry != "" {
		if parsed, err := strconv.Atoi(envExpiry); err == nil && parsed > 0 {
			expiryHours = parsed
		}
	}

	// Generate unique session ID for this login
	sessionID := uuid.New().String()

	// Create claims
	claims := CustomClaims{
		UserID:    userID.String(),
		Email:     email,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * time.Duration(expiryHours))),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign token
	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", "", err
	}

	return tokenString, sessionID, nil
}

// ValidateJWT validates a JWT token and returns the claims
func ValidateJWT(tokenString string) (*CustomClaims, error) {
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, errors.New("JWT_SECRET environment variable not set")
	}

	// Parse token
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	// Extract claims
	claims, ok := token.Claims.(*CustomClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}
