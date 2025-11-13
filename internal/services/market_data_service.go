package services

import (
	"brokerageProject/internal/market_data/twelvedata"
	"brokerageProject/internal/models"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// MarketDataService orchestrates real-time market data from multiple sources:
// 1. Binance WebSocket (crypto) - handled externally in main.go
// 2. Twelve Data WebSocket (forex/commodities) - real-time price updates
type MarketDataService struct {
	twelveDataClient *twelvedata.Client
	priceCache       *PriceCache
	staticPrices     map[string]float64
	broadcastChan    chan []byte // Channel to broadcast updates (connected to hub)
}

// NewMarketDataService creates a new market data orchestration service
func NewMarketDataService(
	twelveDataAPIKey string,
	staticPrices map[string]float64,
	broadcastChan chan []byte,
) (*MarketDataService, error) {
	service := &MarketDataService{
		priceCache:    GetGlobalPriceCache(),
		staticPrices:  staticPrices,
		broadcastChan: broadcastChan,
	}

	// Create Twelve Data WebSocket client with callback
	if twelveDataAPIKey != "" {
		service.twelveDataClient = twelvedata.NewClient(
			twelveDataAPIKey,
			func(symbol string, price float64) {
				// This callback is invoked whenever Twelve Data sends a price update
				service.handlePriceUpdate(symbol, price)
			},
		)
	} else {
		log.Println("WARNING: TWELVE_DATA_API_KEY not set. No real-time forex/commodity data will be available.")
	}

	return service, nil
}

// InitializeWithStaticPrices immediately loads static prices for instant UI responsiveness
// This is called on boot before WebSocket connection is established
func (s *MarketDataService) InitializeWithStaticPrices(staticPrices map[string]float64) {
	log.Println("Initializing market data with static prices...")

	// Immediately broadcast initial prices to UI
	for symbol, price := range staticPrices {
		s.broadcastUpdate(symbol, price)
	}

	log.Printf("Initialized %d symbols with static prices", len(staticPrices))
}

// Start begins the Twelve Data WebSocket connection
func (s *MarketDataService) Start() {
	if s.twelveDataClient == nil {
		log.Println("Twelve Data client not initialized. Skipping WebSocket connection.")
		return
	}

	log.Println("Starting Twelve Data WebSocket connection...")
	s.twelveDataClient.Start()
}

// Stop gracefully shuts down the WebSocket connection
func (s *MarketDataService) Stop() {
	if s.twelveDataClient != nil {
		log.Println("Stopping Twelve Data WebSocket connection...")
		s.twelveDataClient.Stop()
	}
}

// handlePriceUpdate is the callback invoked by Twelve Data client for each price update
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
		log.Printf("ERROR: Failed to marshal price update for %s: %v", symbol, err)
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
