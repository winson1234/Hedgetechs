package main

import (
	"brokerageProject/internal/market_data/twelvedata"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	// Load .env file (try multiple paths)
	envPaths := []string{".env", "../../.env", "../.env"}
	envLoaded := false
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			log.Printf("✓ Loaded .env from: %s", path)
			envLoaded = true
			break
		}
	}

	if !envLoaded {
		log.Fatal("Could not load .env file from any location")
	}

	apiKey := os.Getenv("TWELVE_DATA_API_KEY")
	if apiKey == "" {
		log.Fatal("TWELVE_DATA_API_KEY not set in environment")
	}

	log.Printf("Twelve Data API Key loaded: %s...", apiKey[:10])
	log.Println("Starting WebSocket connection test...")

	// Create client with callback that logs price updates
	client := twelvedata.NewClient(apiKey, func(symbol string, price float64) {
		log.Printf("✓ PRICE UPDATE: %s = %.5f", symbol, price)
	})

	// Start connection
	client.Start()
	log.Println("WebSocket connection initiated. Waiting for price updates...")
	log.Println("Expected symbols: WTI, BRENT, NATGAS, CADJPY, AUDNZD, EURGBP")
	log.Println("Press Ctrl+C to stop")

	// Keep running for 60 seconds to see price updates
	time.Sleep(60 * time.Second)

	// Stop gracefully
	log.Println("\nStopping WebSocket connection...")
	client.Stop()
	log.Println("Test completed successfully")
}
