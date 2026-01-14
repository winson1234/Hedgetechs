package api

import (
	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"
	"brokerageProject/internal/services"
	"brokerageProject/internal/utils"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

// HandleGetProfile fetches the authenticated user's profile
func HandleGetProfile(keycloak *services.KeycloakService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get user UUID from token
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "missing_token", "Authorization header required")
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "invalid_token", "Invalid authorization format")
			return
		}
		tokenString := parts[1]

		// Validate token to get Keycloak UUID
		keycloakUUID, _, err := keycloak.ValidateUserToken(r.Context(), tokenString)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired token")
			return
		}

		ctx := r.Context()
		pool, err := database.GetPool()
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
			return
		}

		// 2. Fetch User Profile
		var user models.UserInfo
		var avatarURL *string

		query := `
			SELECT user_id, keycloak_id, email, first_name, last_name, phone_number, country, is_active, avatar_url, created_at
			FROM users
			WHERE keycloak_id = $1
		`
		err = pool.QueryRow(ctx, query, keycloakUUID).Scan(
			&user.UserID,
			&user.KeycloakID,
			&user.Email,
			&user.FirstName,
			&user.LastName,
			&user.PhoneNumber,
			&user.Country,
			&user.IsActive,
			&avatarURL,
			&user.CreatedAt,
		)

		if err != nil {
			utils.RespondWithJSONError(w, http.StatusNotFound, "user_not_found", "User profile not found")
			return
		}

		if avatarURL != nil {
			user.ProfilePicture = *avatarURL
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
	}
}

// HandleUpdateProfile handles user profile update requests (Name, Phone, Country)
// Email update is currently NOT supported via this endpoint as it requires re-verification flow.
func HandleUpdateProfile(keycloak *services.KeycloakService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// 1. Get authenticated user from context
		email, err := middleware.GetUserEmailFromContext(r.Context())
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "authentication_error", "User not authenticated")
			return
		}

		// Get user UUID from token
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "missing_token", "Authorization header required")
			return
		}
		parts := strings.SplitN(authHeader, " ", 2)
		tokenString := parts[1]

		// Validate token to get Keycloak UUID
		keycloakUUID, _, err := keycloak.ValidateUserToken(r.Context(), tokenString)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "invalid_token", "Invalid or expired token")
			return
		}

		// 2. Parse request body
		type UpdateProfileRequest struct {
			FirstName      string `json:"first_name"`
			LastName       string `json:"last_name"`
			PhoneNumber    string `json:"phone_number"`
			Country        string `json:"country"`
			ProfilePicture string `json:"profile_picture"`
		}
		var req UpdateProfileRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
			return
		}

		// Basic validation
		if req.FirstName == "" || req.LastName == "" || req.Country == "" {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "First Name, Last Name, and Country are required")
			return
		}

		ctx := r.Context()
		pool, err := database.GetPool()
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
			return
		}

		// 3. Update Local DB
		// Use KeycloakUUID to identify user
		// Note: IF ProfilePicture is empty string, we treat it as "no change" to avoid wiping it on partial updates?
		// However, a PUT should technically replace. But since frontend might not send it every time,
		// let's check if it is provided?
		// Limitation: Go struct default zero value is "". We can't distinguish absent vs empty.
		// Unless we use pointer.
		// For now, let's assume if it is present it updates.
		// Actually, to make it robust for "I just want to update name", we should use dynamic query or coalesce?
		// COALESCE(NULLIF($5, ''), avatar_url) -> if $5 is empty, keep existing.
		// This prevents accidental wiping if frontend forgets to send it.
		// But forbids "deleting" the image (setting to empty).
		// For now, let's use COALESCE strategy to be safe against current frontend behavior.

		query := `
			UPDATE users 
			SET first_name = $1, last_name = $2, phone_number = $3, country = $4, 
			    avatar_url = COALESCE(NULLIF($5, ''), avatar_url), 
			    last_updated_at = $6
			WHERE keycloak_id = $7
			RETURNING user_id, email, first_name, last_name, phone_number, country, is_active, avatar_url, created_at
		`
		var user models.UserInfo
		var isActive bool
		var avatarURL *string

		err = pool.QueryRow(ctx, query,
			req.FirstName,
			req.LastName,
			req.PhoneNumber,
			req.Country,
			req.ProfilePicture,
			time.Now(),
			keycloakUUID,
		).Scan(
			&user.UserID,
			&user.Email,
			&user.FirstName,
			&user.LastName,
			&user.PhoneNumber,
			&user.Country,
			&isActive,
			&avatarURL,
			&user.CreatedAt,
		)

		if err != nil {
			fmt.Printf("Failed to update local user: %v\n", err)
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to update local user record")
			return
		}

		if avatarURL != nil {
			user.ProfilePicture = *avatarURL
		}

		// 4. Update Keycloak
		// ... (attributes logic)
		// We don't sync avatar to Keycloak attributes usually (too big).

		// Let's select user_type from DB to preserve it
		var userType string
		err = pool.QueryRow(ctx, "SELECT user_type FROM users WHERE keycloak_id = $1", keycloakUUID).Scan(&userType)
		if err != nil {
			userType = "trader" // fallback
		}

		attributes := map[string][]string{
			"country":      {req.Country},
			"phone_number": {req.PhoneNumber},
			"user_type":    {userType},
		}

		// Perform Keycloak update
		if err := keycloak.UpdateUser(ctx, keycloakUUID, req.FirstName, req.LastName, attributes); err != nil {
			fmt.Printf("[WARNING] Failed to update Keycloak user: %v\n", err)
			// We don't fail the request completely if DB update succeeded, but we should warn.
			// Ideally we want consistency.
			// For now, let's return success but log error.
		}

		// 5. Audit Log
		if utils.GlobalAuditLogger != nil {
			userIDUUID, _ := uuid.Parse(keycloakUUID)
			auditEntry := models.NewAuditLogEntry(userIDUUID, "user_profile_updated", models.ResourceTypeUser).
				WithMetadata("email", email).
				WithMetadata("updated_fields", "name,phone,country,avatar")
			utils.GlobalAuditLogger.LogFromRequest(ctx, r, auditEntry)
		}

		// 6. Response
		response := map[string]interface{}{
			"message": "Profile updated successfully",
			"success": true,
			"user":    user, // Use the full user object with updated fields
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
