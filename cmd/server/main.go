package main

import (
	"brokerageProject/internal/api"
	"brokerageProject/internal/binance"
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub"
	"brokerageProject/internal/services"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file at root directory
	// Try multiple paths to find .env file
	envPaths := []string{
		filepath.Join("..", "..", ".env"),  // When run from cmd/server/
		".env",                               // When run from project root
		filepath.Join(".", ".env"),          // Alternative for project root
	}

	envLoaded := false
	for _, envPath := range envPaths {
		if err := godotenv.Load(envPath); err == nil {
			log.Printf("Successfully loaded .env file from: %s", envPath)
			envLoaded = true
			break
		}
	}

	if !envLoaded {
		log.Println("Warning: .env file not found in any expected location")
		log.Println("Searched paths:", envPaths)
		log.Println("Using system environment variables")
	}

	// Log Stripe configuration status (without revealing the key)
	if stripeKey := os.Getenv("STRIPE_SECRET_KEY"); stripeKey != "" {
		log.Printf("STRIPE_SECRET_KEY loaded successfully (length: %d)", len(stripeKey))
	} else {
		log.Println("WARNING: STRIPE_SECRET_KEY is not set!")
	}

	// Initialize Stripe after loading environment variables
	api.InitializeStripe()

	log.Println("Starting Market Data Relay Server on", config.LocalServerAddress)

	// Create and run the central hub
	h := hub.NewHub()
	go h.Run()

	// Start listening to the Binance stream and pass messages to the hub
	go binance.StreamTrades(h)
	// Start listening to the Binance depth stream for order book data
	go binance.StreamDepth(h)

	// Initialize Alpha Vantage service
	alphaVantageService := services.NewAlphaVantageService()
	alphaVantageHandler := api.NewAlphaVantageHandler(alphaVantageService)

	// Configure the HTTP server
	// WebSocket handler uses the hub instance
	http.HandleFunc(config.LocalWebSocketPath, func(w http.ResponseWriter, r *http.Request) {
		api.HandleWebSocket(h, w, r)
	})
	// REST handler for klines
	http.HandleFunc(config.KlinesAPIPath, api.HandleKlines)
	// REST handler for 24h ticker data
	http.HandleFunc(config.TickerAPIPath, api.HandleTicker)
	// REST handler for news feed
	http.HandleFunc(config.NewsAPIPath, api.HandleNews)
	// REST handler for Alpha Vantage analytics
	http.HandleFunc(config.AlphaVantageAPIPath, alphaVantageHandler.HandleAlphaVantage)
	// REST handler for Stripe payment intent creation
	http.HandleFunc(config.PaymentIntentAPIPath, api.HandleCreatePaymentIntent)

	// Start the local HTTP server
	log.Fatal(http.ListenAndServe(config.LocalServerAddress, nil))
}
