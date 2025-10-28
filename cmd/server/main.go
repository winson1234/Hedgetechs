package main

import (
	"brokerageProject/internal/api"
	"brokerageProject/internal/binance"
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub"
	"brokerageProject/internal/services"
	"log"
	"net/http"
	"path/filepath"

	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file at root directory
	// Go up two directories from cmd/server/ to reach the project root
	envPath := filepath.Join("..", "..", ".env")
	if err := godotenv.Load(envPath); err != nil {
		log.Println("Warning: .env file not found at", envPath)
		log.Println("Trying to load from current directory...")
		if err := godotenv.Load(); err != nil {
			log.Println("Warning: .env file not found, using system environment variables")
		}
	}

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

	// Start the local HTTP server
	log.Fatal(http.ListenAndServe(config.LocalServerAddress, nil))
}
