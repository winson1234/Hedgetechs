package services

import (
	"brokerageProject/internal/market_data"
	"brokerageProject/internal/models"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// MarketDataService orchestrates real-time market data from multiple providers:
// 1. Binance Provider (crypto) - real-time WebSocket stream
// 2. Twelve Data Provider (forex/commodities) - smart polling with simulation
//
// This service uses the Provider interface, allowing seamless switching between
// real-time streams and simulated data without changing the orchestration logic.
type MarketDataService struct {
	providers     []market_data.Provider // List of all active data providers
	priceCache    *PriceCache
	broadcastChan chan []byte // Channel to broadcast updates (connected to hub)
}

// NewMarketDataService creates a new market data orchestration service
// The service manages multiple providers and broadcasts their updates
func NewMarketDataService(
	broadcastChan chan []byte,
) (*MarketDataService, error) {
	service := &MarketDataService{
		providers:     make([]market_data.Provider, 0),
		priceCache:    GetGlobalPriceCache(),
		broadcastChan: broadcastChan,
	}

	return service, nil
}

// AddProvider registers a new market data provider
// This allows the service to aggregate data from multiple sources
func (s *MarketDataService) AddProvider(provider market_data.Provider) {
	s.providers = append(s.providers, provider)
}

// InitializeWithStaticPrices immediately loads static prices for instant UI responsiveness
// This is called on boot to ensure the UI never shows "loading..." states
func (s *MarketDataService) InitializeWithStaticPrices(staticPrices map[string]float64) {
	log.Println("[MarketDataService] Initializing with static prices...")

	// Immediately broadcast initial prices to UI
	for symbol, price := range staticPrices {
		s.broadcastUpdate(symbol, price)
	}

	log.Printf("[MarketDataService] Initialized %d symbols with static prices", len(staticPrices))
}

// Start begins all registered providers
func (s *MarketDataService) Start(symbols []string) error {
	if len(s.providers) == 0 {
		log.Println("[MarketDataService] WARNING: No providers registered")
		return nil
	}

	log.Printf("[MarketDataService] Starting %d provider(s)...", len(s.providers))

	// Start each provider with the unified callback
	for i, provider := range s.providers {
		if err := provider.Subscribe(symbols, s.handlePriceUpdate); err != nil {
			log.Printf("[MarketDataService] WARNING: Provider %d failed to start: %v", i+1, err)
			// Continue with other providers (fail-open strategy)
		}
	}

	log.Println("[MarketDataService] All providers started successfully")
	return nil
}

// Stop gracefully shuts down all providers
func (s *MarketDataService) Stop() {
	log.Printf("[MarketDataService] Stopping %d provider(s)...", len(s.providers))

	for _, provider := range s.providers {
		provider.Stop()
	}

	log.Println("[MarketDataService] All providers stopped")
}

// handlePriceUpdate is the unified callback invoked by all providers
// This is where the "magic" happens: regardless of the source (WebSocket, polling, simulation),
// all price updates flow through this single function
func (s *MarketDataService) handlePriceUpdate(symbol string, price float64) {
	s.broadcastUpdate(symbol, price)
}

// broadcastUpdate sends a price update through all required channels:
// 1. PriceCache (for market order execution)
// 2. messageBroadcaster (for WebSocket clients and OrderProcessor)
func (s *MarketDataService) broadcastUpdate(symbol string, price float64) {
	// 1. Update global price cache (CRITICAL for order execution)
	s.priceCache.UpdatePrice(symbol, price)

	// 2. Create price update message matching Binance format
	priceUpdate := models.PriceUpdateMessage{
		Symbol: symbol,
		Price:  fmt.Sprintf("%.5f", price),
		Time:   time.Now().UnixMilli(),
	}

	// Marshal to JSON
	updateJSON, err := json.Marshal(priceUpdate)
	if err != nil {
		log.Printf("[MarketDataService] ERROR: Failed to marshal price update for %s: %v", symbol, err)
		return
	}

	// 3. Broadcast to hub (non-blocking send)
	select {
	case s.broadcastChan <- updateJSON:
		// Successfully sent
	default:
		// Channel full, drop message (ok for high-frequency updates)
	}
}
