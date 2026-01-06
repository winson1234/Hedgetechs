package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		// Default to dev info if not set
		dbURL = "postgres://postgres:postgres@postgres:5432/brokerage_dev?sslmode=disable"
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Unable to parse DB URL: %v", err)
	}

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()

	// 1. Get a user
	var userID int64
	err = pool.QueryRow(ctx, "SELECT user_id FROM users LIMIT 1").Scan(&userID)
	if err != nil {
		log.Fatalf("Failed to get user: %v", err)
	}
	fmt.Printf("Using UserID: %d\n", userID)

	// 2. Logic from accounts.go
	accountType := "live"

	// Generate account_id
	var accountID int64
	maxAttempts := 10
	attempt := 0

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Fatalf("Failed to begin tx: %v", err)
	}
	defer tx.Rollback(ctx)

	for attempt < maxAttempts {
		var maxAccountID *int64
		err = tx.QueryRow(ctx,
			`SELECT COALESCE(MAX(account_id), 0) FROM accounts WHERE account_type = $1::account_type_enum`,
			accountType,
		).Scan(&maxAccountID)
		if err != nil {
			log.Fatalf("Failed to get max ID: %v", err)
		}

		if maxAccountID == nil {
			maxAccountID = new(int64)
			*maxAccountID = 0
		}

		fmt.Printf("Max Account ID found: %d\n", *maxAccountID)

		if accountType == "live" {
			if *maxAccountID < 10001 {
				accountID = 10001
			} else {
				accountID = *maxAccountID + 1
			}
		} else {
			// ...
		}

		fmt.Printf("Attempting with Account ID: %d\n", accountID)

		// Check existence
		var exists bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM accounts WHERE account_id = $1)`, accountID).Scan(&exists)
		if err != nil {
			log.Fatalf("Failed check exists: %v", err)
		}

		if !exists {
			break
		}
		attempt++
	}

	// Insert
	newUUID := uuid.New()
	fmt.Printf("Inserting account %s...\n", newUUID)

	_, err = tx.Exec(ctx,
		`INSERT INTO accounts (id, user_id, account_id, account_type, currency, balance, status, last_updated, created_at)
		 VALUES ($1, $2, $3, $4::account_type_enum, $5, $6, $7::account_status_enum, NOW(), NOW())`,
		newUUID, userID, accountID, accountType, "USD", 0, "active",
	)

	if err != nil {
		log.Fatalf("INSERT FAILED: %v", err)
	}

	fmt.Println("INSERT SUCCESSFUL")
	tx.Rollback(ctx) // Rollback to not dirty DB
}
