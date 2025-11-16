package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	// Redis Pub/Sub channel for real-time price updates
	PubSubChannel = "fx_price_updates"

	// Redis Hash key for storing latest prices (state persistence)
	HashKey = "fx_latest_prices"

	// Reconnection settings
	maxBackoff     = 60 * time.Second
	initialBackoff = 1 * time.Second
)

// PriceUpdate represents the JSON message published by the MT5 publisher service
type PriceUpdate struct {
	Symbol    string  `json:"symbol"`
	Bid       float64 `json:"bid"`
	Ask       float64 `json:"ask"`
	Timestamp int64   `json:"timestamp"`
}

// Provider implements the market_data.Provider interface for Redis Pub/Sub.
// It receives real-time forex prices from the MT5 publisher service.
type Provider struct {
	redisAddr     string
	redisPassword string
	client        *redis.Client
	pubsub        *redis.PubSub

	onTick    func(string, float64)
	stopChan  chan struct{}
	wg        sync.WaitGroup
	mu        sync.Mutex
	isRunning bool

	ctx    context.Context
	cancel context.CancelFunc
}

// NewProvider creates a new Redis provider
// password can be empty string if Redis doesn't require authentication
func NewProvider(redisAddr string, redisPassword string) *Provider {
	ctx, cancel := context.WithCancel(context.Background())

	return &Provider{
		redisAddr:     redisAddr,
		redisPassword: redisPassword,
		stopChan:      make(chan struct{}),
		ctx:           ctx,
		cancel:        cancel,
	}
}

// Subscribe implements the market_data.Provider interface
func (p *Provider) Subscribe(symbols []string, onTick func(string, float64)) error {
	p.mu.Lock()
	p.onTick = onTick
	p.isRunning = true
	p.mu.Unlock()

	// Initialize Redis client
	p.client = redis.NewClient(&redis.Options{
		Addr:         p.redisAddr,
		Password:     p.redisPassword, // Empty string if no password
		DB:           0,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
		MaxRetries:   3,
	})

	// Test connection
	if err := p.client.Ping(p.ctx).Err(); err != nil {
		return fmt.Errorf("redis connection failed: %w", err)
	}

	log.Printf("[Redis Provider] Connected to Redis at %s", p.redisAddr)

	// Step 1: Seed price cache from Redis Hash (critical for startup)
	if err := p.seedPriceCache(); err != nil {
		log.Printf("[Redis Provider] Warning: Failed to seed price cache: %v", err)
		// Don't fail - we can still listen for new updates
	}

	// Step 2: Start listening to Pub/Sub for real-time updates
	p.wg.Add(1)
	go p.subscribeToPubSub()

	log.Printf("[Redis Provider] Subscribed to forex stream (Pub/Sub channel: %s)", PubSubChannel)
	return nil
}

// seedPriceCache fetches latest prices from Redis Hash and calls onTick for each
// This ensures the backend has prices immediately on startup, even before new ticks arrive
func (p *Provider) seedPriceCache() error {
	result, err := p.client.HGetAll(p.ctx, HashKey).Result()
	if err != nil {
		return fmt.Errorf("HGETALL failed: %w", err)
	}

	if len(result) == 0 {
		log.Println("[Redis Provider] No prices found in Redis hash - cache will be populated as new prices arrive")
		return nil
	}

	seededCount := 0
	p.mu.Lock()
	defer p.mu.Unlock()

	for symbol, priceDataStr := range result {
		// Parse JSON payload with bid/ask
		var priceData struct {
			Bid float64 `json:"bid"`
			Ask float64 `json:"ask"`
		}

		if err := json.Unmarshal([]byte(priceDataStr), &priceData); err != nil {
			log.Printf("[Redis Provider] Warning: Invalid price data for %s: %s", symbol, priceDataStr)
			continue
		}

		// Calculate mid price (average of bid and ask)
		midPrice := (priceData.Bid + priceData.Ask) / 2.0

		// Call onTick to populate the cache
		if p.onTick != nil && midPrice > 0 {
			p.onTick(symbol, midPrice)
			seededCount++
		}
	}

	log.Printf("[Redis Provider] Seeded price cache with %d forex pairs from Redis hash", seededCount)
	return nil
}

// subscribeToPubSub listens to Redis Pub/Sub channel for real-time price updates
func (p *Provider) subscribeToPubSub() {
	defer p.wg.Done()

	backoff := initialBackoff

	for {
		// Check if we should stop
		select {
		case <-p.stopChan:
			return
		default:
		}

		// Create Pub/Sub subscription
		p.pubsub = p.client.Subscribe(p.ctx, PubSubChannel)

		// Wait for confirmation
		_, err := p.pubsub.Receive(p.ctx)
		if err != nil {
			log.Printf("[Redis Provider] Pub/Sub subscription failed: %v. Reconnecting in %s", err, backoff)
			p.sleep(backoff)
			backoff = p.increaseBackoff(backoff)
			continue
		}

		log.Printf("[Redis Provider] Subscribed to Pub/Sub channel: %s", PubSubChannel)
		backoff = initialBackoff

		// Start reading messages
		p.readPubSubMessages()

		// Connection lost, check if we should reconnect
		p.mu.Lock()
		running := p.isRunning
		p.mu.Unlock()

		if !running {
			return
		}

		log.Printf("[Redis Provider] Pub/Sub connection lost. Reconnecting in %s...", backoff)
		p.sleep(backoff)
		backoff = p.increaseBackoff(backoff)
	}
}

// readPubSubMessages reads messages from the Pub/Sub channel
func (p *Provider) readPubSubMessages() {
	defer func() {
		if p.pubsub != nil {
			p.pubsub.Close()
		}
	}()

	ch := p.pubsub.Channel()

	for {
		select {
		case <-p.stopChan:
			return
		case msg, ok := <-ch:
			if !ok {
				// Channel closed
				log.Println("[Redis Provider] Pub/Sub channel closed")
				return
			}

			// Parse JSON message
			var update PriceUpdate
			if err := json.Unmarshal([]byte(msg.Payload), &update); err != nil {
				log.Printf("[Redis Provider] Failed to parse message: %v", err)
				continue
			}

			// Validate data
			if update.Symbol == "" || update.Bid <= 0 || update.Ask <= 0 {
				continue
			}

			// Calculate mid price (average of bid and ask)
			midPrice := (update.Bid + update.Ask) / 2.0

			// Call onTick callback
			p.mu.Lock()
			if p.onTick != nil {
				p.onTick(update.Symbol, midPrice)
			}
			p.mu.Unlock()
		}
	}
}

// Stop gracefully shuts down the provider
func (p *Provider) Stop() {
	p.mu.Lock()
	if !p.isRunning {
		p.mu.Unlock()
		return
	}
	p.isRunning = false
	p.mu.Unlock()

	// Cancel context
	p.cancel()

	// Close stop channel to signal goroutines
	close(p.stopChan)

	// Close Pub/Sub if active
	if p.pubsub != nil {
		p.pubsub.Close()
	}

	// Close Redis client
	if p.client != nil {
		if err := p.client.Close(); err != nil {
			log.Printf("[Redis Provider] Error closing Redis client: %v", err)
		}
	}

	// Wait for goroutines to finish
	p.wg.Wait()

	log.Println("[Redis Provider] Stopped")
}

// Helper functions for backoff and sleep

func (p *Provider) sleep(duration time.Duration) {
	select {
	case <-p.stopChan:
		return
	case <-time.After(duration):
		return
	}
}

func (p *Provider) increaseBackoff(current time.Duration) time.Duration {
	next := current * 2
	if next > maxBackoff {
		return maxBackoff
	}
	return next
}
