package services

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/Nerzal/gocloak/v13"
)

// KeycloakService handles interactions with the Keycloak server
type KeycloakService struct {
	client       *gocloak.GoCloak
	serverURL    string
	realm        string
	clientID     string
	clientSecret string
	adminUser    string
	adminPass    string
	adminToken   *gocloak.JWT
	tokenMutex   sync.Mutex
}

// NewKeycloakService creates a new instance of KeycloakService
func NewKeycloakService() *KeycloakService {
	// Defaults for development
	serverURL := os.Getenv("KEYCLOAK_URL")
	if serverURL == "" {
		serverURL = "http://localhost:8082" // Port mapped in docker-compose
	}

	realm := os.Getenv("KEYCLOAK_REALM")
	if realm == "" {
		realm = "hedgetechs"
	}

	clientID := os.Getenv("KEYCLOAK_CLIENT_ID")
	if clientID == "" {
		clientID = "brokerage-app"
	}

	clientSecret := os.Getenv("KEYCLOAK_CLIENT_SECRET")
	// If public client, secret might be empty

	adminUser := os.Getenv("KEYCLOAK_ADMIN")
	if adminUser == "" {
		adminUser = "admin"
	}

	adminPass := os.Getenv("KEYCLOAK_ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "admin"
	}

	return &KeycloakService{
		client:       gocloak.NewClient(serverURL),
		serverURL:    serverURL,
		realm:        realm,
		clientID:     clientID,
		clientSecret: clientSecret,
		adminUser:    adminUser,
		adminPass:    adminPass,
	}
}

// EnsureAdminToken ensures we have a valid admin token for administrative ops
func (s *KeycloakService) EnsureAdminToken(ctx context.Context) error {
	s.tokenMutex.Lock()
	defer s.tokenMutex.Unlock()

	// If token exists and is valid, return
	if s.adminToken != nil {
		// Basic expiration check (if access token is present)
		// GoCloak JWT struct doesn't expose easy expiry check without parsing,
		// but we can try to validate or just re-login if fails.
		// For simplicity/robustness, let's just re-login if it's been a while or rely on retry.
		// A better approach is to track expiry time.
		// For now, let's just get a new one if it's nil. Real prod code should refresh.
		return nil
	}

	// Login as admin to the "master" realm (or the realm where admin exists)
	// Usually admin is in "master"
	token, err := s.client.LoginAdmin(ctx, s.adminUser, s.adminPass, "master")
	if err != nil {
		return fmt.Errorf("failed to login as admin: %w", err)
	}

	s.adminToken = token
	return nil
}

// RegisterUser creates a new user in Keycloak
func (s *KeycloakService) RegisterUser(ctx context.Context, email, password, firstName, lastName, country, phoneNumber string) (string, error) {
	if err := s.EnsureAdminToken(ctx); err != nil {
		return "", err
	}

	accessToken := s.adminToken.AccessToken

	enabled := true
	user := gocloak.User{
		Username:      gocloak.StringP(email), // Use email as username
		Email:         gocloak.StringP(email),
		FirstName:     gocloak.StringP(firstName),
		LastName:      gocloak.StringP(lastName),
		Enabled:       gocloak.BoolP(enabled),
		EmailVerified: gocloak.BoolP(false), // Should verify email
		Attributes: &map[string][]string{
			"country":      {country},
			"phone_number": {phoneNumber},
		},
	}

	// Create User
	userID, err := s.client.CreateUser(ctx, getPtr(accessToken), s.realm, user)
	if err != nil {
		// If token invalid, retry once (simple refresh logic)
		if isTokenError(err) {
			s.adminToken = nil
			if retryErr := s.EnsureAdminToken(ctx); retryErr == nil {
				accessToken = s.adminToken.AccessToken
				userID, err = s.client.CreateUser(ctx, getPtr(accessToken), s.realm, user)
			}
		}

		if err != nil {
			// Check for conflict (User already exists)
			if strings.Contains(err.Error(), "409") {
				return "", fmt.Errorf("user with this email already exists")
			}
			return "", fmt.Errorf("failed to create user: %w", err)
		}
	}

	// Set Password
	if err := s.client.SetPassword(ctx, getPtr(accessToken), userID, s.realm, password, false); err != nil {
		// Cleanup user if password fails? Or just return error
		return userID, fmt.Errorf("failed to set password: %w", err)
	}

	return userID, nil
}

// Login authenticates a user and returns the token
func (s *KeycloakService) Login(ctx context.Context, email, password string) (*gocloak.JWT, error) {
	// Login with password grant
	token, err := s.client.Login(ctx, s.clientID, s.clientSecret, s.realm, email, password)
	if err != nil {
		return nil, fmt.Errorf("login failed: %w", err)
	}
	return token, nil
}

// SendVerificationEmail triggers the verify email action
func (s *KeycloakService) SendVerificationEmail(ctx context.Context, userID string) error {
	if err := s.EnsureAdminToken(ctx); err != nil {
		return err
	}

	accessToken := s.adminToken.AccessToken

	// Execute actions email
	actions := []string{"VERIFY_EMAIL"}
	if err := s.client.ExecuteActionsEmail(ctx, getPtr(accessToken), s.realm, gocloak.ExecuteActionsEmail{
		UserID:  gocloak.StringP(userID),
		Actions: &actions,
	}); err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	return nil
}

// SendPasswordResetEmail triggers the update password action
func (s *KeycloakService) SendPasswordResetEmail(ctx context.Context, email string) error {
	if err := s.EnsureAdminToken(ctx); err != nil {
		return err
	}
	accessToken := s.adminToken.AccessToken

	// Get User ID by email
	users, err := s.client.GetUsers(ctx, getPtr(accessToken), s.realm, gocloak.GetUsersParams{
		Email: gocloak.StringP(email),
	})
	if err != nil {
		// Retry if token invalid
		if isTokenError(err) {
			s.tokenMutex.Lock()
			s.adminToken = nil
			s.tokenMutex.Unlock()

			if retryErr := s.EnsureAdminToken(ctx); retryErr == nil {
				accessToken = s.adminToken.AccessToken
				users, err = s.client.GetUsers(ctx, getPtr(accessToken), s.realm, gocloak.GetUsersParams{
					Email: gocloak.StringP(email),
				})
			}
		}

		if err != nil {
			return fmt.Errorf("failed to find user: %w", err)
		}
	}
	if len(users) == 0 {
		return errors.New("user not found")
	}
	userID := *users[0].ID

	actions := []string{"UPDATE_PASSWORD"}
	err = s.client.ExecuteActionsEmail(ctx, getPtr(accessToken), s.realm, gocloak.ExecuteActionsEmail{
		UserID:  gocloak.StringP(userID),
		Actions: &actions,
	})
	if err != nil {
		// Retry if token invalid (in case it expired between GetUsers and ExecuteActions)
		if isTokenError(err) {
			s.tokenMutex.Lock()
			s.adminToken = nil
			s.tokenMutex.Unlock()

			if retryErr := s.EnsureAdminToken(ctx); retryErr == nil {
				accessToken = s.adminToken.AccessToken
				err = s.client.ExecuteActionsEmail(ctx, getPtr(accessToken), s.realm, gocloak.ExecuteActionsEmail{
					UserID:  gocloak.StringP(userID),
					Actions: &actions,
				})
			}
		}

		if err != nil {
			return fmt.Errorf("failed to send password reset email: %w", err)
		}
	}

	return nil
}

// Helper to get string pointer
func getPtr(s string) string {
	return s
}

func isTokenError(err error) bool {
	if err == nil {
		return false
	}
	// Rough check for 401
	return strings.Contains(fmt.Sprint(err), "401 Unauthorized")
}

// ValidateUserToken validates the given access token by calling the UserInfo endpoint
// This ensures the token is valid, active, and belongs to the realm
func (s *KeycloakService) ValidateUserToken(ctx context.Context, accessToken string) (string, string, error) {
	userInfo, err := s.client.GetUserInfo(ctx, accessToken, s.realm)
	if err != nil {
		return "", "", fmt.Errorf("token validation failed: %w", err)
	}

	if userInfo.Sub == nil || userInfo.Email == nil {
		return "", "", errors.New("token missing required claims (sub or email)")
	}

	return *userInfo.Sub, *userInfo.Email, nil
}

// ChangePassword updates the user's password using admin privileges
func (s *KeycloakService) ChangePassword(ctx context.Context, userID, newPassword string) error {
	if err := s.EnsureAdminToken(ctx); err != nil {
		return err
	}

	accessToken := s.adminToken.AccessToken

	// Set Password (temporary=false means it's permanent)
	if err := s.client.SetPassword(ctx, getPtr(accessToken), userID, s.realm, newPassword, false); err != nil {
		// Retry if token invalid
		if isTokenError(err) {
			s.tokenMutex.Lock()
			s.adminToken = nil
			s.tokenMutex.Unlock()

			if retryErr := s.EnsureAdminToken(ctx); retryErr == nil {
				accessToken = s.adminToken.AccessToken
				err = s.client.SetPassword(ctx, getPtr(accessToken), userID, s.realm, newPassword, false)
			}
		}

		if err != nil {
			return fmt.Errorf("failed to set password: %w", err)
		}
	}

	return nil
}

// IsEmailVerified checks if a user's email is verified
func (s *KeycloakService) IsEmailVerified(ctx context.Context, email string) (bool, error) {
	if err := s.EnsureAdminToken(ctx); err != nil {
		return false, err
	}
	accessToken := s.adminToken.AccessToken

	// Get User ID by email
	users, err := s.client.GetUsers(ctx, getPtr(accessToken), s.realm, gocloak.GetUsersParams{
		Email: gocloak.StringP(email),
	})
	if err != nil {
		// Retry if token invalid
		if isTokenError(err) {
			s.tokenMutex.Lock()
			s.adminToken = nil
			s.tokenMutex.Unlock()

			if retryErr := s.EnsureAdminToken(ctx); retryErr == nil {
				accessToken = s.adminToken.AccessToken
				users, err = s.client.GetUsers(ctx, getPtr(accessToken), s.realm, gocloak.GetUsersParams{
					Email: gocloak.StringP(email),
				})
			}
		}

		if err != nil {
			return false, fmt.Errorf("failed to find user: %w", err)
		}
	}

	if len(users) == 0 {
		return false, errors.New("user not found")
	}

	user := users[0]
	if user.EmailVerified == nil {
		return false, nil
	}

	return *user.EmailVerified, nil
}

// ResendVerificationByEmail finds a user by email and sends a verification email
func (s *KeycloakService) ResendVerificationByEmail(ctx context.Context, email string) error {
	if err := s.EnsureAdminToken(ctx); err != nil {
		return err
	}
	accessToken := s.adminToken.AccessToken

	users, err := s.client.GetUsers(ctx, getPtr(accessToken), s.realm, gocloak.GetUsersParams{
		Email: gocloak.StringP(email),
	})
	if err != nil {
		return fmt.Errorf("failed to find user: %w", err)
	}
	if len(users) == 0 {
		return errors.New("user not found")
	}

	return s.SendVerificationEmail(ctx, *users[0].ID)
}
