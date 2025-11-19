package services

import (
	"context"
	"fmt"

	"brokerageProject/internal/database"

	"github.com/google/uuid"
)

// SwitchAccount activates the specified account and deactivates all other accounts for the user
// This ensures only ONE account is 'online' per user at a time
func SwitchAccount(userID uuid.UUID, accountID uuid.UUID) error {
	pool, err := database.GetPool()
	if err != nil {
		return fmt.Errorf("failed to get database pool: %w", err)
	}
	ctx := context.Background()

	// Start a transaction to ensure atomicity
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Verify the account belongs to the user
	var accountUserID uuid.UUID
	checkQuery := `SELECT user_id FROM accounts WHERE id = $1`
	err = tx.QueryRow(ctx, checkQuery, accountID).Scan(&accountUserID)
	if err != nil {
		return fmt.Errorf("account not found: %w", err)
	}

	if accountUserID != userID {
		return fmt.Errorf("account does not belong to user")
	}

	// Set all user's accounts to 'offline'
	offlineQuery := `UPDATE accounts SET status = 'offline' WHERE user_id = $1`
	_, err = tx.Exec(ctx, offlineQuery, userID)
	if err != nil {
		return fmt.Errorf("failed to deactivate accounts: %w", err)
	}

	// Set the target account to 'online'
	onlineQuery := `UPDATE accounts SET status = 'online', last_login = NOW() WHERE id = $1`
	_, err = tx.Exec(ctx, onlineQuery, accountID)
	if err != nil {
		return fmt.Errorf("failed to activate account: %w", err)
	}

	// Update users.is_active to true (since we just activated an account)
	updateUserQuery := `UPDATE users SET is_active = true WHERE id = $1`
	_, err = tx.Exec(ctx, updateUserQuery, userID)
	if err != nil {
		return fmt.Errorf("failed to update user active status: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// UpdateUserActiveStatus updates the users.is_active field based on account statuses
// is_active = true if ANY account is 'online', false if ALL accounts are 'offline'
func UpdateUserActiveStatus(userID uuid.UUID) error {
	pool, err := database.GetPool()
	if err != nil {
		return fmt.Errorf("failed to get database pool: %w", err)
	}
	ctx := context.Background()

	// Check if user has any 'online' accounts
	var onlineCount int
	countQuery := `SELECT COUNT(*) FROM accounts WHERE user_id = $1 AND status = 'online'`
	err = pool.QueryRow(ctx, countQuery, userID).Scan(&onlineCount)
	if err != nil {
		return fmt.Errorf("failed to count online accounts: %w", err)
	}

	// Update users.is_active
	isActive := onlineCount > 0
	updateQuery := `UPDATE users SET is_active = $1 WHERE id = $2`
	_, err = pool.Exec(ctx, updateQuery, isActive, userID)
	if err != nil {
		return fmt.Errorf("failed to update user active status: %w", err)
	}

	return nil
}

// DeactivateAllAccounts sets all accounts of a user to 'offline' and updates users.is_active to false
func DeactivateAllAccounts(userID uuid.UUID) error {
	pool, err := database.GetPool()
	if err != nil {
		return fmt.Errorf("failed to get database pool: %w", err)
	}
	ctx := context.Background()

	// Start a transaction
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Set all accounts to 'offline'
	accountQuery := `UPDATE accounts SET status = 'offline' WHERE user_id = $1`
	_, err = tx.Exec(ctx, accountQuery, userID)
	if err != nil {
		return fmt.Errorf("failed to deactivate accounts: %w", err)
	}

	// Update users.is_active to false
	userQuery := `UPDATE users SET is_active = false WHERE id = $1`
	_, err = tx.Exec(ctx, userQuery, userID)
	if err != nil {
		return fmt.Errorf("failed to update user active status: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
