package services

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"
)

const (
	// Drift threshold: Maximum allowed deviation from real FMP baseline (2%)
	DRIFT_THRESHOLD = 0.02

	// Brownian motion parameters: Random walk range per second
	MIN_MOVEMENT_PCT = -0.0005 // -0.05% minimum movement
	MAX_MOVEMENT_PCT = 0.0005  // +0.05% maximum movement

	// Order book spread configuration
	FOREX_SPREAD_PIPS = 3    // 3 pips spread for forex pairs
	OIL_SPREAD_CENTS  = 0.05 // 5 cents spread for oil/commodities
	NATGAS_SPREAD     = 0.01 // 1 cent spread for natural gas
)

// SimulationService manages Brownian motion simulation for forex/commodity prices
// It maintains live simulated prices that drift randomly but stay anchored to real FMP baselines
type SimulationService struct {
	mu                     sync.RWMutex
	currentSimulatedPrices map[string]float64 // Live simulated prices (updated every second)
	lastRealPrices         map[string]float64 // Baseline from FMP (updated every 6 minutes)
	driftThreshold         float64            // Maximum allowed drift percentage (default 2%)
	rng                    *rand.Rand         // Random number generator for Brownian motion
}

// OrderBookLevel represents a single price level in the order book
type OrderBookLevel struct {
	Price    string `json:"price"`
	Quantity string `json:"quantity"`
}

// OrderBookUpdate represents the simulated order book update message
// This matches the exact structure of Binance OrderBookUpdate for frontend compatibility
type OrderBookUpdate struct {
	Symbol string           `json:"symbol"`
	Bids   [][]string       `json:"bids"` // [price, quantity] pairs
	Asks   [][]string       `json:"asks"` // [price, quantity] pairs
}

// NewSimulationService creates a new simulation service instance
func NewSimulationService() *SimulationService {
	return &SimulationService{
		currentSimulatedPrices: make(map[string]float64),
		lastRealPrices:         make(map[string]float64),
		driftThreshold:         DRIFT_THRESHOLD,
		rng:                    rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// InitializeWithStaticPrices sets initial simulated prices from static configuration
// This is called on boot to provide immediate live prices before the first FMP fetch
func (s *SimulationService) InitializeWithStaticPrices(staticPrices map[string]float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for symbol, price := range staticPrices {
		s.currentSimulatedPrices[symbol] = price
		s.lastRealPrices[symbol] = price
	}
}

// ApplyMicroMovement applies a single Brownian motion tick to a price
// Returns the new simulated price after applying random drift and correction
func (s *SimulationService) ApplyMicroMovement(symbol string, currentPrice float64) float64 {
	s.mu.RLock()
	realPrice, hasRealPrice := s.lastRealPrices[symbol]
	s.mu.RUnlock()

	if !hasRealPrice {
		// No baseline price, return unchanged
		return currentPrice
	}

	// Generate random drift: ±0.05% per second
	randomDriftPct := MIN_MOVEMENT_PCT + s.rng.Float64()*(MAX_MOVEMENT_PCT-MIN_MOVEMENT_PCT)
	randomDrift := currentPrice * randomDriftPct
	newPrice := currentPrice + randomDrift

	// Drift correction: If simulated price drifts >2% from real baseline, pull it back
	drift := math.Abs((newPrice - realPrice) / realPrice)
	if drift > s.driftThreshold {
		// Gradually pull back towards real price (90% simulated, 10% real)
		// This creates a "rubber band" effect that prevents excessive drift
		newPrice = newPrice*0.9 + realPrice*0.1
	}

	return newPrice
}

// ApplyMicroMovementToAll applies Brownian motion to all simulated symbols
// Returns a map of symbol → new simulated price
func (s *SimulationService) ApplyMicroMovementToAll() map[string]float64 {
	s.mu.Lock()
	defer s.mu.Unlock()

	updates := make(map[string]float64)

	for symbol, currentPrice := range s.currentSimulatedPrices {
		realPrice, hasRealPrice := s.lastRealPrices[symbol]
		if !hasRealPrice {
			continue
		}

		// Generate random drift
		randomDriftPct := MIN_MOVEMENT_PCT + s.rng.Float64()*(MAX_MOVEMENT_PCT-MIN_MOVEMENT_PCT)
		randomDrift := currentPrice * randomDriftPct
		newPrice := currentPrice + randomDrift

		// Drift correction
		drift := math.Abs((newPrice - realPrice) / realPrice)
		if drift > s.driftThreshold {
			newPrice = newPrice*0.9 + realPrice*0.1
		}

		// Update internal state
		s.currentSimulatedPrices[symbol] = newPrice
		updates[symbol] = newPrice
	}

	return updates
}

// HardResetToRealPrices resets the simulation baseline to new FMP prices
// Called every 6 minutes when fresh FMP data arrives
func (s *SimulationService) HardResetToRealPrices(realPrices map[string]float64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Update both baseline and current simulated prices
	for symbol, price := range realPrices {
		s.lastRealPrices[symbol] = price
		s.currentSimulatedPrices[symbol] = price // Reset drift
	}
}

// GetCurrentPrice returns the current simulated price for a symbol
func (s *SimulationService) GetCurrentPrice(symbol string) (float64, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	price, ok := s.currentSimulatedPrices[symbol]
	return price, ok
}

// GetAllCurrentPrices returns a snapshot of all current simulated prices
func (s *SimulationService) GetAllCurrentPrices() map[string]float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	snapshot := make(map[string]float64)
	for symbol, price := range s.currentSimulatedPrices {
		snapshot[symbol] = price
	}
	return snapshot
}

// GenerateOrderBook creates a simulated order book for a given symbol and price
// Returns 10 bid levels (below price) and 10 ask levels (above price)
func (s *SimulationService) GenerateOrderBook(symbol string, price float64) OrderBookUpdate {
	spread := s.getSpreadForSymbol(symbol)
	midPrice := price

	// Generate 10 bid levels (decreasing prices below mid)
	bids := make([][]string, 10)
	for i := 0; i < 10; i++ {
		// Bid prices decrease as we go down the book
		bidPrice := midPrice - spread/2 - float64(i)*spread*0.2
		quantity := s.generateRandomQuantity(symbol)
		bids[i] = []string{
			fmt.Sprintf("%.5f", bidPrice),
			fmt.Sprintf("%.2f", quantity),
		}
	}

	// Generate 10 ask levels (increasing prices above mid)
	asks := make([][]string, 10)
	for i := 0; i < 10; i++ {
		// Ask prices increase as we go up the book
		askPrice := midPrice + spread/2 + float64(i)*spread*0.2
		quantity := s.generateRandomQuantity(symbol)
		asks[i] = []string{
			fmt.Sprintf("%.5f", askPrice),
			fmt.Sprintf("%.2f", quantity),
		}
	}

	return OrderBookUpdate{
		Symbol: symbol,
		Bids:   bids,
		Asks:   asks,
	}
}

// getSpreadForSymbol returns the appropriate spread for a symbol
func (s *SimulationService) getSpreadForSymbol(symbol string) float64 {
	switch symbol {
	case "WTI", "BRENT":
		return OIL_SPREAD_CENTS // 5 cents for oil
	case "NATGAS":
		return NATGAS_SPREAD // 1 cent for natural gas
	case "CADJPY", "AUDNZD", "EURGBP":
		// Convert pips to price units
		// For forex, 1 pip = 0.0001 for most pairs
		// CADJPY uses 0.01 (yen pairs have different pip value)
		if symbol == "CADJPY" {
			return float64(FOREX_SPREAD_PIPS) * 0.01 // 3 pips = 0.03 yen
		}
		return float64(FOREX_SPREAD_PIPS) * 0.0001 // 3 pips = 0.0003
	default:
		return 0.0001 // Default small spread
	}
}

// generateRandomQuantity generates a realistic random quantity for order book
func (s *SimulationService) generateRandomQuantity(symbol string) float64 {
	// Different quantity ranges for different asset types
	switch symbol {
	case "WTI", "BRENT", "NATGAS":
		// Commodities: 100-5000 units (barrels, MMBtu)
		return 100 + s.rng.Float64()*4900
	case "CADJPY", "AUDNZD", "EURGBP":
		// Forex: 10,000-1,000,000 units (standard lots)
		return 10000 + s.rng.Float64()*990000
	default:
		return 100 + s.rng.Float64()*9900
	}
}
