package twelvedata

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Adapter implements the smart polling strategy for Twelve Data Free Tier.
//
// Strategy:
// 1. Fetch real prices from REST API every N minutes (configurable, default 9m)
// 2. Cache the "Base Price" for each symbol
// 3. Generate simulated "micro-ticks" every 1 second using tethered random walk
// 4. When next snapshot arrives, update Base Price and reset simulation
//
// This creates the illusion of real-time data while staying within free-tier API limits.
type Adapter struct {
	apiKey          string
	pollInterval    time.Duration
	enableFetch     bool                  // Safety switch: disable API calls during dev
	onTick          func(string, float64) // Callback for price updates
	basePrices      map[string]float64    // Last real price from API
	simulatedPrices map[string]float64    // Current simulated price
	mu              sync.RWMutex          // Protects price maps
	stopChan        chan struct{}         // Signal to stop all goroutines
	isRunning       bool
	symbolMapping   map[string]string // Internal -> External symbol mapping
	reverseMapping  map[string]string // External -> Internal symbol mapping
}

// PriceResponse represents the Twelve Data REST API response
// GET https://api.twelvedata.com/price?symbol=WTI/USD,BZ/USD&apikey=xxx
// Response: {"WTI/USD":{"price":"75.23"},"BZ/USD":{"price":"79.45"}}
type PriceResponse map[string]struct {
	Price string `json:"price"`
}

// NewAdapter creates a new Twelve Data smart polling adapter
//
// Parameters:
//   - apiKey: Twelve Data API key
//   - pollInterval: How often to fetch real prices (e.g., 9 * time.Minute)
//   - enableFetch: Set to false to disable API calls (for testing simulation only)
func NewAdapter(apiKey string, pollInterval time.Duration, enableFetch bool) *Adapter {
	// Symbol mapping: Internal format -> Twelve Data API format (Forex only)
	symbolMapping := map[string]string{
		"CADJPY": "CAD/JPY",
		"AUDNZD": "AUD/NZD",
		"EURGBP": "EUR/GBP",
	}

	// Reverse mapping for response parsing
	reverseMapping := make(map[string]string)
	for internal, external := range symbolMapping {
		reverseMapping[external] = internal
	}

	return &Adapter{
		apiKey:          apiKey,
		pollInterval:    pollInterval,
		enableFetch:     enableFetch,
		basePrices:      make(map[string]float64),
		simulatedPrices: make(map[string]float64),
		stopChan:        make(chan struct{}),
		symbolMapping:   symbolMapping,
		reverseMapping:  reverseMapping,
	}
}

// Subscribe implements the Provider interface
func (a *Adapter) Subscribe(symbols []string, onTick func(string, float64)) error {
	a.onTick = onTick
	a.isRunning = true

	// Initialize base prices with static fallbacks
	// These are used until the first API snapshot arrives
	staticFallbacks := map[string]float64{
		"CADJPY": 108.50,
		"AUDNZD": 1.08,
		"EURGBP": 0.86,
	}

	a.mu.Lock()
	for _, symbol := range symbols {
		if fallbackPrice, exists := staticFallbacks[symbol]; exists {
			a.basePrices[symbol] = fallbackPrice
			a.simulatedPrices[symbol] = fallbackPrice
		}
	}
	a.mu.Unlock()

	// Start the polling loop (fetches real prices every N minutes)
	go a.pollLoop(symbols)

	// Start the simulation ticker (generates micro-ticks every 1 second)
	go a.simulationLoop(symbols)

	log.Printf("[TwelveData Adapter] Subscribed to %d symbols. Poll interval: %v, API fetch enabled: %v",
		len(symbols), a.pollInterval, a.enableFetch)

	return nil
}

// Stop gracefully shuts down the adapter
func (a *Adapter) Stop() {
	if !a.isRunning {
		return
	}
	a.isRunning = false
	close(a.stopChan)
	log.Println("[TwelveData Adapter] Stopped")
}

// pollLoop fetches real prices from the API at regular intervals
func (a *Adapter) pollLoop(symbols []string) {
	// Fetch immediately on startup
	if a.enableFetch {
		a.fetchSnapshot(symbols)
	}

	ticker := time.NewTicker(a.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-a.stopChan:
			return
		case <-ticker.C:
			if a.enableFetch {
				a.fetchSnapshot(symbols)
			}
		}
	}
}

// fetchSnapshot makes a REST API call to get real prices
func (a *Adapter) fetchSnapshot(symbols []string) {
	// Build symbol list for API call (convert internal names to external format)
	var externalSymbols []string
	for _, internalSymbol := range symbols {
		if externalSymbol, exists := a.symbolMapping[internalSymbol]; exists {
			externalSymbols = append(externalSymbols, externalSymbol)
		}
	}

	if len(externalSymbols) == 0 {
		log.Println("[TwelveData Adapter] No symbols to fetch")
		return
	}

	// Build API URL
	symbolList := strings.Join(externalSymbols, ",")
	url := fmt.Sprintf("https://api.twelvedata.com/price?symbol=%s&apikey=%s", symbolList, a.apiKey)

	// Make HTTP request
	resp, err := http.Get(url)
	if err != nil {
		log.Printf("[TwelveData Adapter] ERROR: API request failed: %v", err)
		log.Println("[TwelveData Adapter] Continuing with last known prices (Fail Open)")
		return
	}
	defer resp.Body.Close()

	// Check HTTP status
	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("[TwelveData Adapter] ERROR: API returned HTTP %d: %s", resp.StatusCode, string(body))
		log.Println("[TwelveData Adapter] Continuing with last known prices (Fail Open)")
		return
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[TwelveData Adapter] ERROR: Failed to read response: %v", err)
		return
	}

	var priceData PriceResponse
	if err := json.Unmarshal(body, &priceData); err != nil {
		log.Printf("[TwelveData Adapter] ERROR: Failed to parse JSON: %v", err)
		log.Printf("[TwelveData Adapter] Response body: %s", string(body))
		return
	}

	// Update base prices
	a.mu.Lock()
	updateCount := 0
	for externalSymbol, data := range priceData {
		price := 0.0
		fmt.Sscanf(data.Price, "%f", &price)

		if price > 0 {
			if internalSymbol, exists := a.reverseMapping[externalSymbol]; exists {
				a.basePrices[internalSymbol] = price
				a.simulatedPrices[internalSymbol] = price // Reset simulation to real price
				updateCount++
			}
		}
	}
	a.mu.Unlock()

	log.Printf("[TwelveData Adapter] Fetched real snapshot. Updated %d symbols. Credits used: ~%d",
		updateCount, len(externalSymbols))
}

// simulationLoop generates micro-ticks every second using tethered random walk
func (a *Adapter) simulationLoop(symbols []string) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// Seed random number generator
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))

	for {
		select {
		case <-a.stopChan:
			return
		case <-ticker.C:
			a.generateTicks(symbols, rng)
		}
	}
}

// generateTicks applies tethered random walk to simulate price movement
func (a *Adapter) generateTicks(symbols []string, rng *rand.Rand) {
	a.mu.Lock()
	defer a.mu.Unlock()

	for _, symbol := range symbols {
		basePrice, hasBase := a.basePrices[symbol]
		simulatedPrice, hasSimulated := a.simulatedPrices[symbol]

		if !hasBase || !hasSimulated || basePrice == 0 {
			continue // Skip if no base price available
		}

		// Calculate drift from real snapshot price
		drift := (simulatedPrice - basePrice) / basePrice

		// Tethering logic: If drifted too far, force correction
		var randomChange float64
		if drift > 0.005 { // Drifted +0.5% above real price
			// Force negative movement
			randomChange = -rng.Float64() * 0.0005
		} else if drift < -0.005 { // Drifted -0.5% below real price
			// Force positive movement
			randomChange = rng.Float64() * 0.0005
		} else {
			// Normal random walk: ±0.05% per second
			randomChange = (rng.Float64()*2 - 1) * 0.0005
		}

		// Apply change
		newPrice := simulatedPrice * (1 + randomChange)

		// Safety bounds: Never drift more than ±1% from base price
		maxPrice := basePrice * 1.01
		minPrice := basePrice * 0.99
		newPrice = math.Max(minPrice, math.Min(maxPrice, newPrice))

		// Update simulated price
		a.simulatedPrices[symbol] = newPrice
	}

	// Unlock before calling callbacks to avoid deadlock
	a.mu.Unlock()

	// Broadcast updates
	a.mu.RLock()
	for _, symbol := range symbols {
		if price, exists := a.simulatedPrices[symbol]; exists && price > 0 {
			a.onTick(symbol, price)
		}
	}
	a.mu.RUnlock()

	// Re-lock for defer
	a.mu.Lock()
}
