package api

import (
	"context"
	"encoding/json"
	"fmt"
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

	// Insert into pending_registrationss table
	pool, err := database.GetPool()
	if err != nil {
		utils.RespondWithJSONError(w, http.StatusInternalServerError, "database_error", "Failed to connect to database")
		return
	}
	ctx := context.Background()

	query := `
		INSERT INTO pending_registrationss
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
		if strings.Contains(err.Error(), "pending_registrationss_email_key") {
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
	query := `SELECT status FROM pending_registrationss WHERE email = $1`
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

	// First, check pending_registrationss table for status
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
		FROM pending_registrationss
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
		// User doesn't exist, create from pending_registrationss
		userID = regID // Use the same ID from pending_registrationss
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
