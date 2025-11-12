package services

import (
	"fmt"
	"sync"
	"time"
)

// PriceCache provides thread-safe access to real-time market prices
// Prices are updated by the WebSocket price stream and consumed by order execution
type PriceCache struct {
	mu     sync.RWMutex
	prices map[string]PriceCacheEntry
}

// PriceCacheEntry stores a price with metadata
type PriceCacheEntry struct {
	Price     float64
	UpdatedAt time.Time
}

// Global instance - initialized once at startup
var globalPriceCache *PriceCache
var once sync.Once

// GetGlobalPriceCache returns the singleton price cache instance
func GetGlobalPriceCache() *PriceCache {
	once.Do(func() {
		globalPriceCache = &PriceCache{
			prices: make(map[string]PriceCacheEntry),
		}
	})
	return globalPriceCache
}

// UpdatePrice updates the cached price for a symbol (called by WebSocket stream)
func (pc *PriceCache) UpdatePrice(symbol string, price float64) {
	pc.mu.Lock()
	defer pc.mu.Unlock()

	pc.prices[symbol] = PriceCacheEntry{
		Price:     price,
		UpdatedAt: time.Now(),
	}
}

// GetPrice retrieves the current price for a symbol
// Returns error if symbol not found or data is stale (>60 seconds old)
func (pc *PriceCache) GetPrice(symbol string) (float64, error) {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	entry, exists := pc.prices[symbol]
	if !exists {
		return 0, fmt.Errorf("no price data available for %s", symbol)
	}

	// Check if data is stale (older than 60 seconds)
	if time.Since(entry.UpdatedAt) > 60*time.Second {
		return 0, fmt.Errorf("price data for %s is stale (last update: %v)", symbol, entry.UpdatedAt)
	}

	return entry.Price, nil
}

// GetPriceWithAge retrieves the price and the age of the data
func (pc *PriceCache) GetPriceWithAge(symbol string) (float64, time.Duration, error) {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	entry, exists := pc.prices[symbol]
	if !exists {
		return 0, 0, fmt.Errorf("no price data available for %s", symbol)
	}

	age := time.Since(entry.UpdatedAt)
	return entry.Price, age, nil
}

// GetAllPrices returns a snapshot of all current prices
func (pc *PriceCache) GetAllPrices() map[string]float64 {
	pc.mu.RLock()
	defer pc.mu.RUnlock()

	snapshot := make(map[string]float64, len(pc.prices))
	for symbol, entry := range pc.prices {
		snapshot[symbol] = entry.Price
	}
	return snapshot
}
