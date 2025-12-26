package market_data

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"time"

	"github.com/redis/go-redis/v9"
)

// MockForexPublisher simulates MT5 publisher for localhost development
// Publishes forex prices to Redis fx_price_updates channel with realistic variations
type MockForexPublisher struct {
	redisClient *redis.Client
	symbols     []string
	basePrices  map[string]float64
	stopChan    chan struct{}
	isRunning   bool
}

// NewMockForexPublisher creates a new mock forex publisher
func NewMockForexPublisher(redisClient *redis.Client, symbols []string) *MockForexPublisher {
	// Base prices (mid-market rates)
	basePrices := map[string]float64{
		"EURUSD": 1.08,
		"GBPUSD": 1.27,
		"USDJPY": 150.00,
		"AUDUSD": 0.64,
		"NZDUSD": 0.59,
		"USDCHF": 0.88,
		"CADJPY": 108.50,
		"AUDNZD": 1.08,
		"EURGBP": 0.86,
		"USDCAD": 1.35,
		"EURJPY": 162.00,
		"GBPJPY": 190.50,
	}

	return &MockForexPublisher{
		redisClient: redisClient,
		symbols:     symbols,
		basePrices:  basePrices,
		stopChan:    make(chan struct{}),
	}
}

// Start begins publishing mock forex prices to Redis
func (m *MockForexPublisher) Start(ctx context.Context) {
	if m.isRunning {
		return
	}
	m.isRunning = true

	log.Println("[Mock Forex Publisher] Starting mock forex price publisher for localhost development...")
	log.Printf("[Mock Forex Publisher] Will publish prices for %d symbols every 500ms", len(m.symbols))
	log.Printf("[Mock Forex Publisher] Symbols: %v", m.symbols)

	// Initialize random seed
	rand.Seed(time.Now().UnixNano())

	// Publish prices every 500ms (2 updates per second, matching production rate limit)
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[Mock Forex Publisher] Stopping...")
			m.isRunning = false
			return
		case <-m.stopChan:
			log.Println("[Mock Forex Publisher] Stopping...")
			m.isRunning = false
			return
		case <-ticker.C:
			m.publishPrices(ctx)
		}
	}
}

// Stop gracefully stops the publisher
func (m *MockForexPublisher) Stop() {
	if !m.isRunning {
		return
	}
	close(m.stopChan)
}

// publishPrices publishes price updates for all symbols
func (m *MockForexPublisher) publishPrices(ctx context.Context) {
	for _, symbol := range m.symbols {
		basePrice, exists := m.basePrices[symbol]
		if !exists {
			// Initialize with a default price if not in basePrices
			log.Printf("[Mock Forex Publisher] WARNING: No base price for %s, skipping", symbol)
			continue
		}

		// Generate realistic price variation (±0.1% for most pairs, ±0.01% for JPY pairs)
		var variation float64
		if symbol[len(symbol)-3:] == "JPY" {
			// JPY pairs: smaller variation (0.01%)
			variation = (rand.Float64() - 0.5) * 0.0002 * basePrice
		} else {
			// Other pairs: larger variation (0.1%)
			variation = (rand.Float64() - 0.5) * 0.002 * basePrice
		}

		midPrice := basePrice + variation

		// Calculate bid/ask spread (typically 1-3 pips for major pairs)
		var spread float64
		if symbol[len(symbol)-3:] == "JPY" {
			spread = 0.01 * (1 + rand.Float64()*2) // 1-3 pips for JPY pairs
		} else {
			spread = 0.0001 * (1 + rand.Float64()*2) // 1-3 pips for other pairs
		}

		bid := midPrice - spread/2
		ask := midPrice + spread/2

		// Update base price slightly (random walk)
		m.basePrices[symbol] = midPrice

		// Create price update message
		update := map[string]interface{}{
			"symbol":    symbol,
			"bid":       bid,
			"ask":       ask,
			"timestamp": time.Now().UnixMilli(),
		}

		updateJSON, err := json.Marshal(update)
		if err != nil {
			log.Printf("[Mock Forex Publisher] ERROR marshalling update for %s: %v", symbol, err)
			continue
		}

		// Publish to Redis fx_price_updates channel
		err = m.redisClient.Publish(ctx, "fx_price_updates", string(updateJSON)).Err()
		if err != nil {
			log.Printf("[Mock Forex Publisher] ERROR publishing %s to Redis: %v", symbol, err)
			continue
		}

		// Also update Redis hash for persistence (used by API endpoints)
		priceData := map[string]interface{}{
			"bid":       bid,
			"ask":       ask,
			"timestamp": time.Now().UnixMilli(),
		}
		priceJSON, err := json.Marshal(priceData)
		if err != nil {
			log.Printf("[Mock Forex Publisher] ERROR marshalling price data for %s: %v", symbol, err)
			continue
		}
		
		err = m.redisClient.Set(ctx, "forex:price:"+symbol, priceJSON, 5*time.Minute).Err()
		if err != nil {
			log.Printf("[Mock Forex Publisher] ERROR setting Redis cache for %s: %v", symbol, err)
			continue
		}
	}
}

