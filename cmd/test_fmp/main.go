package main

import (
	"brokerageProject/internal/market_data"
	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Test script to verify FMP API connectivity and response parsing
// Usage: go run cmd/test_fmp/main.go
func main() {
	// Load environment variables FIRST (before accessing os.Getenv)
	if err := godotenv.Load(".env"); err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	// Get FMP API key directly from environment (not from config package)
	apiKey := os.Getenv("FMP_API_KEY")
	if apiKey == "" {
		log.Fatal("ERROR: FMP_API_KEY environment variable is not set")
	}

	enableFetch := os.Getenv("ENABLE_FMP_FETCH")
	log.Println("FMP API Key loaded successfully")
	log.Printf("ENABLE_FMP_FETCH: %s", enableFetch)

	// Create FMP client
	persistenceFile := "./data/market_data_state.json"
	client, err := market_data.NewFMPClient(apiKey, persistenceFile)
	if err != nil {
		log.Fatalf("Failed to create FMP client: %v", err)
	}

	log.Println("FMP client created successfully")
	log.Println("Persistence file:", persistenceFile)
	log.Println("\nFetching batch quotes for 6 symbols (WTI, BRENT, NATGAS, CADJPY, AUDNZD, EURGBP)...")

	// Fetch quotes
	quotes, err := client.FetchBatchQuotes()
	if err != nil {
		log.Fatalf("Failed to fetch quotes: %v", err)
	}

	// Display results
	log.Println("\nSuccessfully fetched quotes:")
	log.Println("=" + fmt.Sprintf("%50s", " "))

	for _, symbol := range market_data.GetInternalSymbols() {
		quote, ok := quotes[symbol]
		if !ok {
			log.Printf("WARNING: Symbol %s not found in response", symbol)
			continue
		}

		log.Printf("Symbol: %-8s | Price: $%.4f | Change: %+.2f%% | Volume: %d",
			symbol,
			quote.Price,
			quote.ChangesPercentage,
			quote.Volume,
		)
	}

	log.Println("=" + fmt.Sprintf("%50s", " "))
	log.Println("\nTest completed successfully!")

	// Check persistence file
	if _, err := os.Stat(persistenceFile); err == nil {
		log.Println("Persistence file created successfully at:", persistenceFile)
	} else {
		log.Println("WARNING: Persistence file not found:", persistenceFile)
	}

	log.Println("\nNext fetch will be allowed in 6 minutes (360 seconds)")
	log.Println("Try running this script again immediately to test rate limiting...")
}
