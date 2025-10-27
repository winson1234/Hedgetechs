package main

import (
	"brokerageProject/internal/api"
	"brokerageProject/internal/binance"
	"brokerageProject/internal/config"
	"brokerageProject/internal/hub"
	"log"
	"net/http"
)

func main() {
	log.Println("Starting Market Data Relay Server on", config.LocalServerAddress)

	// Create and run the central hub
	h := hub.NewHub()
	go h.Run()

	// Start listening to the Binance stream and pass messages to the hub
	go binance.StreamTrades(h)

	// Configure the HTTP server
	// WebSocket handler uses the hub instance
	http.HandleFunc(config.LocalWebSocketPath, func(w http.ResponseWriter, r *http.Request) {
		api.HandleWebSocket(h, w, r)
	})
	// REST handler for klines
	http.HandleFunc(config.KlinesAPIPath, api.HandleKlines)
	// REST handler for 24h ticker data
	http.HandleFunc(config.TickerAPIPath, api.HandleTicker)

	// Start the local HTTP server
	log.Fatal(http.ListenAndServe(config.LocalServerAddress, nil))
}
