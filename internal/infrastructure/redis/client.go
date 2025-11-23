package redis

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	client *redis.Client
)

// Config holds Redis connection configuration
type Config struct {
	Addr     string
	Password string
	DB       int
}

// InitClient initializes the Redis client singleton with connection pooling
// Context timeouts: 5s connection, 3s read/write operations
func InitClient(cfg Config) error {
	client = redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		Protocol:     2, // RESP2
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10, // Connection pool size
		MinIdleConns: 2,  // Minimum idle connections
	})

	// Health check
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to ping Redis: %w", err)
	}

	log.Printf("[REDIS] Connected to Redis at %s", cfg.Addr)
	return nil
}

// InitClientFromEnv initializes the Redis client from environment variables
func InitClientFromEnv() error {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379" // Default
	}

	password := os.Getenv("REDIS_PASSWORD")

	db := 0 // Default DB
	// If you need to parse REDIS_DB from env, add that here

	return InitClient(Config{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
}

// GetClient returns the singleton Redis client instance
// Returns nil if InitClient has not been called
func GetClient() *redis.Client {
	return client
}

// CloseClient gracefully closes the Redis connection
func CloseClient() error {
	if client == nil {
		return nil
	}

	if err := client.Close(); err != nil {
		return fmt.Errorf("failed to close Redis client: %w", err)
	}

	log.Println("[REDIS] Connection closed")
	return nil
}

// HealthCheck performs a health check on the Redis connection
func HealthCheck(ctx context.Context) error {
	if client == nil {
		return fmt.Errorf("redis client not initialized")
	}

	return client.Ping(ctx).Err()
}
