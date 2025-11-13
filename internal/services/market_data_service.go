package services

import (
	"brokerageProject/internal/config"
	"brokerageProject/internal/market_data"
	"brokerageProject/internal/models"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// MarketDataService orchestrates hybrid market data from multiple sources:
// 1. Binance WebSocket (crypto) - handled externally in main.go
// 2. FMP API snapshots (forex/commodities) - fetched every 6 minutes
// 3. Brownian motion simulation - applied every 1 second
type MarketDataService struct {
	fmpClient         *market_data.FMPClient
	simulationService *SimulationService
	priceCache        *PriceCache
	enableFMPFetch    bool
	staticPrices      map[string]float64
	broadcastChan     chan []byte // Channel to broadcast updates (connected to hub)
}

// NewMarketDataService creates a new market data orchestration service
func NewMarketDataService(
	fmpAPIKey string,
	persistenceFile string,
	enableFMPFetch bool,
	staticPrices map[string]float64,
	broadcastChan chan []byte,
) (*MarketDataService, error) {
	// Create FMP client (even if disabled, for potential future use)
	var fmpClient *market_data.FMPClient
	var err error

	if fmpAPIKey != "" {
		fmpClient, err = market_data.NewFMPClient(fmpAPIKey, persistenceFile)
		if err != nil {
			log.Printf("WARNING: Failed to create FMP client: %v", err)
			log.Println("Falling back to static prices only")
		}
	}

	return &MarketDataService{
		fmpClient:         fmpClient,
		simulationService: NewSimulationService(),
		priceCache:        GetGlobalPriceCache(),
		enableFMPFetch:    enableFMPFetch,
		staticPrices:      staticPrices,
		broadcastChan:     broadcastChan,
	}, nil
}

// InitializeWithStaticPrices immediately loads static prices for instant UI responsiveness
// This is called on boot before any FMP fetches
func (s *MarketDataService) InitializeWithStaticPrices(staticPrices map[string]float64) {
	log.Println("Initializing market data with static prices...")
	s.simulationService.InitializeWithStaticPrices(staticPrices)

	// Immediately broadcast initial prices to UI
	for symbol, price := range staticPrices {
		s.broadcastUpdate(symbol, price)
	}

	log.Printf("Initialized %d symbols with static prices", len(staticPrices))
}

// StartHybridPolling starts all market data goroutines:
// 1. FMP snapshot polling (every 6 minutes)
// 2. Brownian motion simulation (every 1 second)
// 3. Order book simulation (every 1 second, staggered)
func (s *MarketDataService) StartHybridPolling(ctx context.Context) {
	log.Println("Starting hybrid market data polling...")

	// Goroutine 1: FMP Snapshot Polling (Every 6 minutes)
	go s.runFMPPolling(ctx)

	// Goroutine 2: Brownian Motion Simulation (Every 1 second)
	go s.runBrownianMotion(ctx)

	// Goroutine 3: Order Book Simulation (Every 1 second, staggered by 500ms)
	go s.runOrderBookSimulation(ctx)

	log.Println("All market data goroutines started successfully")
}

// runFMPPolling handles periodic FMP API calls every 6 minutes
func (s *MarketDataService) runFMPPolling(ctx context.Context) {
	pollInterval := time.Duration(config.FMPPollIntervalSeconds) * time.Second
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	log.Printf("FMP polling started (interval: %v, enabled: %v)", pollInterval, s.enableFMPFetch)

	// Attempt immediate first fetch (if rate limit allows)
	if s.enableFMPFetch && s.fmpClient != nil {
		s.fetchAndUpdateFMPPrices()
	}

	for {
		select {
		case <-ticker.C:
			if s.enableFMPFetch && s.fmpClient != nil {
				s.fetchAndUpdateFMPPrices()
			} else {
				// Dev mode: Reset to static prices periodically
				log.Println("FMP fetch disabled, resetting to static prices")
				s.simulationService.HardResetToRealPrices(s.staticPrices)
			}
		case <-ctx.Done():
			log.Println("FMP polling stopped")
			return
		}
	}
}

// fetchAndUpdateFMPPrices fetches fresh FMP data and resets simulation baseline
func (s *MarketDataService) fetchAndUpdateFMPPrices() {
	log.Println("Fetching FMP batch quotes...")

	quotes, err := s.fmpClient.FetchBatchQuotes()
	if err != nil {
		log.Printf("ERROR: FMP fetch failed: %v", err)
		return
	}

	// Convert FMPQuote map to simple price map
	realPrices := make(map[string]float64)
	for symbol, quote := range quotes {
		realPrices[symbol] = quote.Price
		log.Printf("FMP: %s = $%.4f (change: %+.2f%%)", symbol, quote.Price, quote.ChangesPercentage)
	}

	// Hard reset simulation baseline (eliminates accumulated drift)
	s.simulationService.HardResetToRealPrices(realPrices)
	log.Printf("Successfully updated %d symbols from FMP", len(realPrices))
}

// runBrownianMotion applies micro-movements to all simulated prices every second
func (s *MarketDataService) runBrownianMotion(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	log.Println("Brownian motion simulation started (1-second ticks)")

	for {
		select {
		case <-ticker.C:
			// Apply micro-movements to all simulated symbols
			updates := s.simulationService.ApplyMicroMovementToAll()

			// Broadcast all price updates
			for symbol, price := range updates {
				s.broadcastUpdate(symbol, price)
			}

		case <-ctx.Done():
			log.Println("Brownian motion simulation stopped")
			return
		}
	}
}

// runOrderBookSimulation generates simulated order books every second
func (s *MarketDataService) runOrderBookSimulation(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// Stagger by 500ms to avoid synchronized CPU spikes with price updates
	time.Sleep(500 * time.Millisecond)

	log.Println("Order book simulation started (1-second ticks, staggered)")

	for {
		select {
		case <-ticker.C:
			// Generate order books for all simulated symbols
			for _, symbol := range market_data.GetInternalSymbols() {
				price, ok := s.simulationService.GetCurrentPrice(symbol)
				if !ok {
					continue
				}

				orderBook := s.simulationService.GenerateOrderBook(symbol, price)
				s.broadcastOrderBook(orderBook)
			}

		case <-ctx.Done():
			log.Println("Order book simulation stopped")
			return
		}
	}
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

// broadcastOrderBook sends an order book update to WebSocket clients
func (s *MarketDataService) broadcastOrderBook(orderBook OrderBookUpdate) {
	// Marshal to JSON
	orderBookJSON, err := json.Marshal(orderBook)
	if err != nil {
		log.Printf("ERROR: Failed to marshal order book for %s: %v", orderBook.Symbol, err)
		return
	}

	// Broadcast to hub (non-blocking send)
	select {
	case s.broadcastChan <- orderBookJSON:
		// Successfully sent
	default:
		// Channel full, drop message
	}
}
