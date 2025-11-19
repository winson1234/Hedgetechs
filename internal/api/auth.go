package api

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"brokerageProject/internal/database"
	"brokerageProject/internal/models"
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
		regID          uuid.UUID
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
		userID = regID // Use the same ID from pending_registrations
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

// OTP storage (in production, use Redis with expiry)
var otpStore = make(map[string]struct {
	OTP       string
	ExpiresAt time.Time
})

// Reset token storage (in production, use Redis with expiry)
var resetTokenStore = make(map[string]struct {
	Email     string
	ExpiresAt time.Time
})

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

// HandleForgotPassword handles forgot password requests
func HandleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req models.ForgotPasswordRequest
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

	// Check if user exists in pending_registrations table
	var status string
	query := `SELECT status FROM pending_registrations WHERE email = $1`
	err = pool.QueryRow(ctx, query, req.Email).Scan(&status)

	if err != nil {
		response := models.ForgotPasswordResponse{
			Message: "No account found with this email address",
			Status:  "not_found",
			Success: false,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Check registration status
	if status == "pending" {
		response := models.ForgotPasswordResponse{
			Message: "Your registration is still pending admin approval. Password reset is not available.",
			Status:  "pending",
			Success: false,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(response)
		return
	}

	if status == "rejected" {
		response := models.ForgotPasswordResponse{
			Message: "Your registration has been rejected. Password reset is not available. Please contact support.",
			Status:  "rejected",
			Success: false,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Status is approved - generate OTP
	otp, err := generateOTP()
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "server_error", "Failed to generate OTP")
		return
	}

	// Store OTP with 10-minute expiry (in production, use Redis)
	otpStore[req.Email] = struct {
		OTP       string
		ExpiresAt time.Time
	}{
		OTP:       otp,
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}

	// In production, send OTP via email
	// For development, log OTP to console AND include in response
	fmt.Printf("\n=================================\n")
	fmt.Printf("🔐 PASSWORD RESET OTP\n")
	fmt.Printf("=================================\n")
	fmt.Printf("Email: %s\n", req.Email)
	fmt.Printf("OTP: %s\n", otp)
	fmt.Printf("Expires: %s\n", time.Now().Add(10*time.Minute).Format(time.RFC3339))
	fmt.Printf("=================================\n\n")

	response := models.ForgotPasswordResponse{
		Message: "OTP has been sent! For development, check the response or backend console.",
		Status:  "success",
		Success: true,
		OTP:     otp, // Include OTP in response for development (remove in production)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleVerifyOTP handles OTP verification requests
func HandleVerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req models.VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" || req.OTP == "" {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Email and OTP are required")
		return
	}

	// Check if OTP exists and is valid
	stored, exists := otpStore[req.Email]
	if !exists {
		response := models.VerifyOTPResponse{
			Message: "No OTP found for this email. Please request a new OTP.",
			Success: false,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Check if OTP is expired
	if time.Now().After(stored.ExpiresAt) {
		delete(otpStore, req.Email)
		response := models.VerifyOTPResponse{
			Message: "OTP has expired. Please request a new OTP.",
			Success: false,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusGone)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Verify OTP
	if stored.OTP != req.OTP {
		response := models.VerifyOTPResponse{
			Message: "Invalid OTP. Please check and try again.",
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

	// Store reset token with 15-minute expiry
	resetTokenStore[resetToken] = struct {
		Email     string
		ExpiresAt time.Time
	}{
		Email:     req.Email,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}

	// Remove OTP from store (one-time use)
	delete(otpStore, req.Email)

	response := models.VerifyOTPResponse{
		Message:    "OTP verified successfully. You can now reset your password.",
		Success:    true,
		ResetToken: resetToken,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleResetPassword handles password reset requests
func HandleResetPassword(w http.ResponseWriter, r *http.Request) {
	var req models.ResetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" || req.ResetToken == "" || req.NewPassword == "" {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Email, reset token, and new password are required")
		return
	}

	// Validate password strength
	if len(req.NewPassword) < 8 {
		utils.RespondWithJSONError(w, http.StatusBadRequest, "validation_error", "Password must be at least 8 characters")
		return
	}

	// Check if reset token exists and is valid
	stored, exists := resetTokenStore[req.ResetToken]
	if !exists {
		response := models.ResetPasswordResponse{
			Message: "Invalid or expired reset token. Please request a new OTP.",
			Success: false,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Check if token is expired
	if time.Now().After(stored.ExpiresAt) {
		delete(resetTokenStore, req.ResetToken)
		response := models.ResetPasswordResponse{
			Message: "Reset token has expired. Please request a new OTP.",
			Success: false,
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusGone)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Verify email matches
	if stored.Email != req.Email {
		response := models.ResetPasswordResponse{
			Message: "Email does not match reset token.",
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
	ctx := context.Background()

	// Update password in pending_registrations table
	updateQuery := `
		UPDATE pending_registrations
		SET hash_password = $1
		WHERE email = $2 AND status = 'approved'
	`
	result, err := pool.Exec(ctx, updateQuery, hashedPassword, req.Email)
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", fmt.Sprintf("Failed to update password: %v", err))
		return
	}

	rowsAffected := result.RowsAffected()
	if rowsAffected == 0 {
		utils.RespondWithJSONError(w, http.StatusNotFound, "not_found", "User not found or not approved")
		return
	}

	// Also update password in users table if user exists
	updateUserQuery := `
		UPDATE users
		SET hash_password = $1, last_updated_at = NOW()
		WHERE email = $2
	`
	pool.Exec(ctx, updateUserQuery, hashedPassword, req.Email)

	// Remove reset token from store (one-time use)
	delete(resetTokenStore, req.ResetToken)

	response := models.ResetPasswordResponse{
		Message: "Password reset successfully. You can now log in with your new password.",
		Success: true,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
