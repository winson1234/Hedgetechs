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
		filepath.Join("..", "..", ".env"), // When run from cmd/server/
		".env",                            // When run from project root
		filepath.Join(".", ".env"),        // Alternative for project root
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

	// Get port from environment (required for Render deployment)
	// Falls back to 8080 for local development
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	serverAddress := ":" + port
	log.Println("Starting Market Data Relay Server on", serverAddress)

	// Middleware to support HEAD requests for UptimeRobot health checks
	allowHEAD := func(handler http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodHead {
				// HEAD requests: return 200 OK without body (for health checks)
				w.WriteHeader(http.StatusOK)
				return
			}
			// All other methods: pass through to original handler
			handler(w, r)
		}
	}

	// Create and run the central hub
	h := hub.NewHub()
	go h.Run()

	// Start Binance WebSocket streams for real-time market data
	log.Println("Starting Binance WebSocket streams")
	go binance.StreamTrades(h)
	go binance.StreamDepth(h)

	// Initialize forex service using Frankfurter API (free, no API key required)
	log.Println("Initializing forex service with Frankfurter API (no API key required)")
	forexService := services.NewMassiveService("")
	analyticsHandler := api.NewAnalyticsHandler(forexService)

	// Configure the HTTP server
	// WebSocket handler uses the hub instance (with CORS)
	http.HandleFunc(config.LocalWebSocketPath, api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
		api.HandleWebSocket(h, w, r)
	}))
	// REST handler for klines (with CORS and HEAD support for health checks)
	http.HandleFunc(config.KlinesAPIPath, api.CORSMiddleware(allowHEAD(api.HandleKlines)))
	// REST handler for 24h ticker data (with CORS and HEAD support for health checks)
	http.HandleFunc(config.TickerAPIPath, api.CORSMiddleware(allowHEAD(api.HandleTicker)))
	// REST handler for news feed (with CORS and HEAD support for health checks)
	http.HandleFunc(config.NewsAPIPath, api.CORSMiddleware(allowHEAD(api.HandleNews)))
	// REST handler for forex rates analytics (with CORS and HEAD support for health checks)
	http.HandleFunc(config.AnalyticsAPIPath, api.CORSMiddleware(allowHEAD(analyticsHandler.HandleAnalytics)))
	// REST handler for Stripe payment intent creation (with CORS)
	http.HandleFunc(config.PaymentIntentAPIPath, api.CORSMiddleware(api.HandleCreatePaymentIntent))
	// REST handler for Stripe payment status check (with CORS)
	http.HandleFunc(config.PaymentStatusAPIPath, api.CORSMiddleware(api.HandlePaymentStatus))
	// REST handler for NOWPayments crypto charge creation (with CORS)
	http.HandleFunc("/api/v1/deposit/create-crypto-charge", api.CORSMiddleware(api.HandleCreateCryptoCharge))
	// Webhook handler for NOWPayments IPN (NO CORS - webhook only)
	http.HandleFunc("/api/v1/crypto/webhook", func(w http.ResponseWriter, r *http.Request) {
		api.HandleCryptoWebhook(h, w, r)
	})

	// Log NOWPayments configuration status
	if nowPaymentsKey := os.Getenv("NOWPAYMENTS_API_KEY"); nowPaymentsKey != "" {
		log.Printf("NOWPAYMENTS_API_KEY loaded successfully (length: %d)", len(nowPaymentsKey))
	} else {
		log.Println("Note: NOWPAYMENTS_API_KEY is not set (crypto deposits disabled)")
	}

	// Start the HTTP server on the configured port
	log.Fatal(http.ListenAndServe(serverAddress, nil))
}
