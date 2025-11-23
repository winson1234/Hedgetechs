package api

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/models"
	"brokerageProject/internal/services"
	"brokerageProject/internal/utils"

	"github.com/google/uuid"
)

// HandleRegister handles user registration requests
func HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	// Validate required fields
	if req.Email == "" || req.Password == "" || req.FirstName == "" || req.LastName == "" {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Email, password, first name, and last name are required")
		return
	}

	// Hash password
	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to process password")
		return
	}

	// Insert into pending_registrations table
	pool, err := database.GetPool()
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
		return
	}
	ctx := context.Background()

	query := `
		INSERT INTO pending_registrations
		(first_name, last_name, email, phone_number, hash_password, country, status)
		VALUES ($1, $2, $3, $4, $5, $6, 'pending')
	`

	_, err = pool.Exec(ctx, query,
		req.FirstName,
		req.LastName,
		req.Email,
		req.PhoneNumber,
		hashedPassword,
		req.Country,
	)

	if err != nil {
		// Check for duplicate email
		if strings.Contains(err.Error(), "pending_registrations_email_key") {
			utils.RespondWithJSONError(w, http.StatusConflict, "duplicate_email", "Email already registered")
			return
		}
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("Failed to create registration: %v", err))
		return
	}

	// Success response
	response := models.RegisterResponse{
		Message: "Registration submitted successfully. Your account is pending admin approval.",
		Success: true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// HandleCheckStatus checks the registration status of a user
func HandleCheckStatus(w http.ResponseWriter, r *http.Request) {
	var req models.CheckStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Email is required")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
		return
	}
	ctx := context.Background()

	var status string
	query := `SELECT status FROM pending_registrations WHERE email = $1`
	err = pool.QueryRow(ctx, query, req.Email).Scan(&status)

	if err != nil {
		response := models.CheckStatusResponse{
			Status:  "not_found",
			Message: "No registration found for this email",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	var message string
	switch status {
	case "pending":
		message = "Your registration is pending admin approval"
	case "approved":
		message = "Your registration has been approved. You can now log in"
	case "rejected":
		message = "Your registration has been rejected"
	default:
		message = "Unknown status"
	}

	response := models.CheckStatusResponse{
		Status:  status,
		Message: message,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleLogin handles user login requests
func HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Email and password are required")
		return
	}

	pool, err := database.GetPool()
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
		return
	}
	ctx := context.Background()

	// First, check pending_registrations table for status
	var (
		regID          int64 // pending_registrations.id is bigint
		status         string
		reviewedAt     *time.Time
		hashedPassword string
		firstName      string
		lastName       string
		phoneNumber    *string
		country        *string
	)

	query := `
		SELECT id, status, reviewed_at, hash_password, first_name, last_name, phone_number, country
		FROM pending_registrations
		WHERE email = $1
	`

	err = pool.QueryRow(ctx, query, req.Email).Scan(
		&regID, &status, &reviewedAt, &hashedPassword, &firstName, &lastName, &phoneNumber, &country,
	)

	if err != nil {
		utils.RespondWithJSONError(w, http.StatusUnauthorized, "authentication_error", "Invalid email or password")
		return
	}

	// Check status
	if status == "pending" {
		response := models.LoginResponse{
			Message: "Your registration is still pending admin approval",
			Status:  "pending",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(response)
		return
	}

	if status == "rejected" {
		response := models.LoginResponse{
			Message: "Your registration has been rejected. Please contact support",
			Status:  "rejected",
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Status is approved - verify password
	if err := utils.VerifyPassword(hashedPassword, req.Password); err != nil {
		utils.RespondWithJSONError(w, http.StatusUnauthorized, "authentication_error", "Invalid email or password")
		return
	}

	// Transfer data to users table if not already exists
	var userID uuid.UUID
	var userExists bool

	checkUserQuery := `SELECT id FROM users WHERE email = $1`
	err = pool.QueryRow(ctx, checkUserQuery, req.Email).Scan(&userID)

	if err != nil {
		// User doesn't exist, create from pending_registrations
		// Generate a new UUID for the user (users.id is UUID, pending_registrations.id is bigint)
		userID = uuid.New()
		createdAt := time.Now()
		if reviewedAt != nil {
			createdAt = *reviewedAt
		}

		// Generate user_id (USR-00001 format)
		var maxUserID int
		countQuery := `SELECT COUNT(*) FROM users`
		pool.QueryRow(ctx, countQuery).Scan(&maxUserID)
		generatedUserID := fmt.Sprintf("USR-%05d", maxUserID+1)

		insertUserQuery := `
			INSERT INTO users
			(id, user_id, first_name, last_name, email, hash_password, phone_number, country, is_active, created_at, last_updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`

		_, err = pool.Exec(ctx, insertUserQuery,
			userID,
			generatedUserID,
			firstName,
			lastName,
			req.Email,
			hashedPassword,
			phoneNumber,
			country,
			true, // is_active defaults to true
			createdAt,
			time.Now(),
		)

		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("Failed to create user account: %v", err))
			return
		}
	} else {
		userExists = true
	}

	// Update last_login
	updateLoginQuery := `UPDATE users SET last_login = $1 WHERE id = $2`
	pool.Exec(ctx, updateLoginQuery, time.Now(), userID)

	// Generate JWT token
	token, err := utils.GenerateJWT(userID, req.Email)
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to generate authentication token")
		return
	}

	// Get user info
	var user models.UserInfo
	getUserQuery := `
		SELECT id, user_id, email, first_name, last_name, phone_number, country, is_active
		FROM users
		WHERE id = $1
	`
	err = pool.QueryRow(ctx, getUserQuery, userID).Scan(
		&user.ID,
		&user.UserID,
		&user.Email,
		&user.FirstName,
		&user.LastName,
		&user.PhoneNumber,
		&user.Country,
		&user.IsActive,
	)

	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to retrieve user information")
		return
	}

	// Success response
	message := "Login successful"
	if !userExists {
		message = "Account created and login successful"
	}

	response := models.LoginResponse{
		Token:   token,
		User:    &user,
		Message: message,
		Status:  "approved",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// generateOTP generates a random 6-digit OTP
func generateOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// generateResetToken generates a random reset token
func generateResetToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", b), nil
}

// HandleForgotPassword returns a handler that processes forgot password requests with rate limiting
func HandleForgotPassword(authStorage *services.AuthStorageService, emailSender services.EmailSender) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.ForgotPasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
			return
		}

		if req.Email == "" {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Email is required")
			return
		}

		ctx := r.Context()

		// CRITICAL: Check rate limit FIRST (3 attempts per hour per email)
		allowed, remaining, err := authStorage.CheckRateLimit(ctx, "forgot_password", req.Email, 3, 1*time.Hour)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to check rate limit")
			return
		}

		if !allowed {
			response := map[string]interface{}{
				"error":               "rate_limit_exceeded",
				"message":             "Too many password reset attempts. Please try again later.",
				"retry_after_seconds": 3600,
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(response)
			return
		}

		pool, err := database.GetPool()
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
			return
		}

		// Constant-time user lookup (prevent timing attacks)
		// CRITICAL: Check users table, not pending_registrations
		// Only allow password reset for registered, active users
		var isActive bool
		var userFound bool
		query := `SELECT is_active FROM users WHERE email = $1`
		err = pool.QueryRow(ctx, query, req.Email).Scan(&isActive)

		if err == nil && isActive {
			userFound = true
		}

		// Always sleep to prevent timing attacks (even if user not found)
		time.Sleep(200 * time.Millisecond)

		// Generic response regardless of user existence (prevent email enumeration)
		response := models.ForgotPasswordResponse{
			Message: "If your email is registered and approved, you will receive a verification code shortly.",
			Status:  "success",
			Success: true,
		}

		// Only actually send OTP if user was found and approved
		if userFound {
			// Generate OTP
			otp, err := generateOTP()
			if err != nil {
				utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to generate OTP")
				return
			}

			// Store OTP in Redis with 10-minute TTL
			if err := authStorage.StoreOTP(ctx, req.Email, otp); err != nil {
				utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to store OTP")
				return
			}

			// Send OTP via email service (Console in dev, Resend in prod)
			if err := emailSender.SendOTP(ctx, req.Email, otp); err != nil {
				utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to send OTP email")
				return
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining-1))
		json.NewEncoder(w).Encode(response)
	}
}

// HandleVerifyOTP returns a handler that processes OTP verification requests
func HandleVerifyOTP(authStorage *services.AuthStorageService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.VerifyOTPRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
			return
		}

		if req.Email == "" || req.OTP == "" {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Email and OTP are required")
			return
		}

		ctx := r.Context()

		// Validate OTP from Redis (auto-deletes on success - one-time use)
		valid := authStorage.ValidateOTP(ctx, req.Email, req.OTP)
		if !valid {
			response := models.VerifyOTPResponse{
				Message: "Invalid or expired OTP. Please request a new one.",
				Success: false,
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(response)
			return
		}

		// OTP is valid - generate reset token
		resetToken, err := generateResetToken()
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to generate reset token")
			return
		}

		// Store reset token in Redis with 15-minute TTL
		if err := authStorage.StoreResetToken(ctx, resetToken, req.Email); err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to store reset token")
			return
		}

		response := models.VerifyOTPResponse{
			Message:    "OTP verified successfully. You can now reset your password.",
			Success:    true,
			ResetToken: resetToken,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// HandleResetPassword returns a handler that processes password reset requests with session revocation
func HandleResetPassword(authStorage *services.AuthStorageService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.ResetPasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
			return
		}

		if req.ResetToken == "" || req.NewPassword == "" {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Reset token and new password are required")
			return
		}

		// Validate password strength
		if len(req.NewPassword) < 8 {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Password must be at least 8 characters")
			return
		}

		ctx := r.Context()

		// Validate reset token from Redis (auto-deletes on success - one-time use)
		email, err := authStorage.ValidateResetToken(ctx, req.ResetToken)
		if err != nil {
			response := models.ResetPasswordResponse{
				Message: "Invalid or expired reset token. Please request a new OTP.",
				Success: false,
			}
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(response)
			return
		}

		// Hash new password
		hashedPassword, err := utils.HashPassword(req.NewPassword)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to process password")
			return
		}

		pool, err := database.GetPool()
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
			return
		}

		// CRITICAL: Update password in BOTH tables to keep them in sync
		// (Login checks pending_registrations, so both tables must match)

		// First, update users table and get UUID
		var userUUID string
		updateUsersQuery := `
			UPDATE users
			SET hash_password = $1, last_updated_at = NOW()
			WHERE email = $2 AND is_active = true
			RETURNING id
		`
		err = pool.QueryRow(ctx, updateUsersQuery, hashedPassword, email).Scan(&userUUID)

		if err == sql.ErrNoRows {
			// User not found or not active
			utils.RespondWithJSONError(w, http.StatusNotFound, "not_found", "User not found or account inactive")
			return
		}

		if err != nil {
			// Database error
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to update password in users table")
			return
		}

		// Second, update pending_registrations table (where login authenticates)
		updatePendingQuery := `
			UPDATE pending_registrations
			SET hash_password = $1, updated_at = NOW()
			WHERE email = $2 AND status = 'approved'
		`
		_, err = pool.Exec(ctx, updatePendingQuery, hashedPassword, email)
		if err != nil {
			// Log warning but don't fail (users table was already updated)
			fmt.Printf("[AUTH WARNING] Failed to update password in pending_registrations for %s: %v\n", email, err)
		}

		// CRITICAL: Revoke all sessions for this user (invalidate existing JWTs)
		if err := authStorage.RevokeSessions(ctx, userUUID); err != nil {
			// Log error but don't fail the request (password was already reset)
			fmt.Printf("[AUTH WARNING] Failed to revoke sessions for user %s: %v\n", userUUID, err)
		}

		response := models.ResetPasswordResponse{
			Message: "Password reset successfully. You can now log in with your new password.",
			Success: true,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}

// HandleChangePassword returns a handler that processes authenticated password change requests with session revocation
func HandleChangePassword(authStorage *services.AuthStorageService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req models.ChangePasswordRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
			return
		}

		if req.CurrentPassword == "" || req.NewPassword == "" {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Current password and new password are required")
			return
		}

		// Validate new password strength
		if len(req.NewPassword) < 8 {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "New password must be at least 8 characters")
			return
		}

		// Check that new password is different from current
		if req.CurrentPassword == req.NewPassword {
			utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "New password must be different from current password")
			return
		}

		ctx := r.Context()

		// Extract user email from JWT context (injected by AuthMiddleware)
		email, err := middleware.GetUserEmailFromContext(ctx)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "authentication_error", "User email not found in context")
			return
		}

		pool, err := database.GetPool()
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
			return
		}

		// Get current password hash and UUID from database
		var currentHashedPassword string
		var userUUID string
		// Check pending_registrations first (where login authenticates)
		pendingQuery := `SELECT hash_password FROM pending_registrations WHERE email = $1 AND status = 'approved'`
		err = pool.QueryRow(ctx, pendingQuery, email).Scan(&currentHashedPassword)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to retrieve user information from pending_registrations")
			return
		}

		// Get user UUID from users table for session revocation
		userQuery := `SELECT id FROM users WHERE email = $1`
		err = pool.QueryRow(ctx, userQuery, email).Scan(&userUUID)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to retrieve user information")
			return
		}

		// Verify current password
		if err := utils.VerifyPassword(currentHashedPassword, req.CurrentPassword); err != nil {
			utils.RespondWithJSONError(w, http.StatusUnauthorized, "authentication_error", "Current password is incorrect")
			return
		}

		// Hash new password
		newHashedPassword, err := utils.HashPassword(req.NewPassword)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to process new password")
			return
		}

		// CRITICAL: Update password in BOTH tables to keep them in sync
		// Update users table
		updateUsersQuery := `UPDATE users SET hash_password = $1, last_updated_at = NOW() WHERE email = $2`
		_, err = pool.Exec(ctx, updateUsersQuery, newHashedPassword, email)
		if err != nil {
			utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to update password in users table")
			return
		}

		// Update pending_registrations table
		updatePendingQuery := `UPDATE pending_registrations SET hash_password = $1, updated_at = NOW() WHERE email = $2 AND status = 'approved'`
		_, err = pool.Exec(ctx, updatePendingQuery, newHashedPassword, email)
		if err != nil {
			// Log warning but don't fail (users table was already updated)
			fmt.Printf("[AUTH WARNING] Failed to update password in pending_registrations for %s: %v\n", email, err)
		}

		// Use userUUID for session revocation
		confirmedUserUUID := userUUID

		// CRITICAL: Revoke all sessions for this user (invalidate all existing JWTs including current one)
		if err := authStorage.RevokeSessions(ctx, confirmedUserUUID); err != nil {
			// Log error but don't fail the request (password was already changed)
			fmt.Printf("[AUTH WARNING] Failed to revoke sessions for user %s: %v\n", confirmedUserUUID, err)
		}

		response := map[string]interface{}{
			"message": "Password changed successfully. Please log in again with your new password.",
			"success": true,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}
}
