package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// Pool is the global database connection pool
	Pool *pgxpool.Pool
)

// InitDB initializes the database connection pool
// Call this once during application startup
func InitDB() error {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	// Parse the connection string and configure the pool
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("unable to parse DATABASE_URL: %w", err)
	}

	// Configure connection pool settings
	config.MaxConns = 25                               // Maximum number of connections in the pool
	config.MinConns = 5                                // Minimum number of connections to maintain
	config.MaxConnLifetime = time.Hour                 // Maximum lifetime of a connection
	config.MaxConnIdleTime = 30 * time.Minute          // Maximum idle time before closing connection
	config.HealthCheckPeriod = 1 * time.Minute         // How often to check connection health
	config.ConnConfig.ConnectTimeout = 5 * time.Second // Timeout for establishing new connections

	// Disable prepared statements for compatibility with PgBouncer (Supabase Session Pooler)
	// Supabase uses PgBouncer in session mode which doesn't support prepared statements
	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	// Set search_path to public schema for all connections
	// This ensures tables are found even when using transaction pooler
	config.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO public")
		return err
	}

	// Create the connection pool
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test the connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return fmt.Errorf("unable to ping database: %w", err)
	}

	// Set the global pool
	Pool = pool

	log.Println("Database connection pool initialized successfully")
	return nil
}

// Close closes the database connection pool
// Call this during graceful shutdown
func Close() {
	if Pool != nil {
		Pool.Close()
		log.Println("Database connection pool closed")
	}
}

// GetPool returns the global database connection pool
// Returns an error if the pool hasn't been initialized
func GetPool() (*pgxpool.Pool, error) {
	if Pool == nil {
		return nil, fmt.Errorf("database pool not initialized - call InitDB() first")
	}
	return Pool, nil
}

// HealthCheck checks if the database connection is healthy
func HealthCheck(ctx context.Context) error {
	pool, err := GetPool()
	if err != nil {
		return err
	}

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("database health check failed: %w", err)
	}

	return nil
}

// GetStats returns current pool statistics
func GetStats() *pgxpool.Stat {
	if Pool == nil {
		return nil
	}
	return Pool.Stat()
}
