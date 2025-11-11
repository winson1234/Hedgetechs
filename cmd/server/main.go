package main

import (
	"brokerageProject/internal/api"
	"brokerageProject/internal/binance"
	"brokerageProject/internal/config"
	"brokerageProject/internal/database"
	"brokerageProject/internal/hub"
	"brokerageProject/internal/middleware"
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

	// Initialize database connection pool
	log.Println("Initializing database connection...")
	if err := database.InitDB(); err != nil {
		log.Printf("WARNING: Failed to initialize database: %v", err)
		log.Println("Account management features will not be available")
	} else {
		log.Println("Database connection initialized successfully")
		// Ensure database connection is closed on shutdown
		defer database.Close()
	}

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

	// Account management endpoints (protected with JWT authentication)
	// POST /api/v1/accounts - Create a new trading account
	http.HandleFunc("/api/v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			// Apply CORS and Auth middleware for POST requests
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateAccount))(w, r)
		} else if r.Method == http.MethodGet {
			// Apply CORS and Auth middleware for GET requests
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetAccounts))(w, r)
		} else if r.Method == http.MethodOptions {
			// Handle preflight CORS requests
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		} else {
			// Method not allowed
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Instruments endpoints (public - no auth required)
	// GET /api/v1/instruments - List all tradeable instruments
	http.HandleFunc("/api/v1/instruments", api.CORSMiddleware(allowHEAD(api.GetInstruments)))
	// GET /api/v1/instruments/symbol?symbol=BTCUSDT - Get instrument by symbol
	http.HandleFunc("/api/v1/instruments/symbol", api.CORSMiddleware(allowHEAD(api.GetInstrumentBySymbol)))

	// Transactions endpoints (protected with JWT authentication)
	// POST /api/v1/transactions - Create transaction (deposit/withdrawal/transfer)
	// GET /api/v1/transactions?account_id={uuid} - List transactions for account
	http.HandleFunc("/api/v1/transactions", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateTransaction))(w, r)
		} else if r.Method == http.MethodGet {
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetTransactions))(w, r)
		} else if r.Method == http.MethodOptions {
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Orders endpoints (protected with JWT authentication)
	// POST /api/v1/orders - Create a new order
	// GET /api/v1/orders?account_id={uuid} - List orders for account
	http.HandleFunc("/api/v1/orders", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateOrder))(w, r)
		} else if r.Method == http.MethodGet {
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetOrders))(w, r)
		} else if r.Method == http.MethodOptions {
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/orders/cancel?order_id={uuid} - Cancel an order
	http.HandleFunc("/api/v1/orders/cancel", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			api.CORSMiddleware(middleware.AuthMiddleware(api.CancelOrder))(w, r)
		} else if r.Method == http.MethodOptions {
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Contracts endpoints (protected with JWT authentication)
	// POST /api/v1/contracts - Open a new position
	// GET /api/v1/contracts?account_id={uuid}&status=open - List contracts
	http.HandleFunc("/api/v1/contracts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateContract))(w, r)
		} else if r.Method == http.MethodGet {
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetContracts))(w, r)
		} else if r.Method == http.MethodOptions {
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/contracts/close?contract_id={uuid} - Close a position
	http.HandleFunc("/api/v1/contracts/close", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			api.CORSMiddleware(middleware.AuthMiddleware(api.CloseContract))(w, r)
		} else if r.Method == http.MethodOptions {
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// PATCH /api/v1/contracts/tpsl?contract_id={uuid} - Update TP/SL
	http.HandleFunc("/api/v1/contracts/tpsl", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPatch || r.Method == http.MethodPost {
			api.CORSMiddleware(middleware.AuthMiddleware(api.UpdateContractTPSL))(w, r)
		} else if r.Method == http.MethodOptions {
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		} else {
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Log NOWPayments configuration status
	if nowPaymentsKey := os.Getenv("NOWPAYMENTS_API_KEY"); nowPaymentsKey != "" {
		log.Printf("NOWPAYMENTS_API_KEY loaded successfully (length: %d)", len(nowPaymentsKey))
	} else {
		log.Println("Note: NOWPAYMENTS_API_KEY is not set (crypto deposits disabled)")
	}

	// Start the HTTP/HTTPS server on the configured port
	// Check for mkcert-generated SSL certificates for local HTTPS development
	certFile := filepath.Join("..", "..", "localhost+2.pem")     // From cmd/server, look at project root
	keyFile := filepath.Join("..", "..", "localhost+2-key.pem")  // From cmd/server, look at project root

	// Check if certificate files exist
	if _, certErr := os.Stat(certFile); certErr == nil {
		if _, keyErr := os.Stat(keyFile); keyErr == nil {
			// Certificates found - start HTTPS server
			log.Printf("SSL certificates found - starting HTTPS server on https://localhost%s", serverAddress)
			log.Println("Note: These are mkcert-generated certificates for local development")
			log.Fatal(http.ListenAndServeTLS(serverAddress, certFile, keyFile, nil))
		}
	}

	// No certificates found - start HTTP server (backward compatible)
	log.Printf("No SSL certificates found - starting HTTP server on http://localhost%s", serverAddress)
	log.Println("Tip: For HTTPS in development, generate certificates with mkcert (see HTTPS_SETUP.md)")
	log.Fatal(http.ListenAndServe(serverAddress, nil))
}
