package main

import (
	"brokerageProject/internal/api"
	"brokerageProject/internal/binance"
	"brokerageProject/internal/config"
	"brokerageProject/internal/database"
	"brokerageProject/internal/hub"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/services"
	"brokerageProject/internal/utils"
	"brokerageProject/internal/worker"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
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
		log.Fatalf("CRITICAL: Failed to initialize database: %v", err)
	}
	log.Println("Database connection initialized successfully")

	// Ensure database connection is closed on shutdown
	defer database.Close()

	// Run database migrations
	log.Println("Running database migrations...")
	if err := runMigrations(); err != nil {
		log.Printf("WARNING: Migration error: %v", err)
		log.Println("Continuing with existing schema...")
	} else {
		log.Println("Database migrations completed successfully")
	}

	// Initialize audit logger (requires database)
	dbPool, err := database.GetPool()
	if err != nil {
		log.Fatalf("CRITICAL: Failed to get database pool: %v", err)
	}
	utils.InitGlobalAuditLogger(dbPool)

	// Initialize rate limiter (100 requests per minute per user, burst of 20)
	middleware.InitRateLimiter(100, 20)

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

	// Initialize event-driven order processor (requires database)
	var orderProcessor *worker.OrderProcessor
	if dbPool, err := database.GetPool(); err == nil {
		orderProcessor = worker.NewOrderProcessor(dbPool)
		go orderProcessor.Run()
	} else {
		log.Println("WARNING: Order processor disabled (database not available)")
	}

	// Create message broadcaster that fans out to both hub and order processor
	// This allows both WebSocket clients and the order processor to receive real-time price updates
	messageBroadcaster := make(chan []byte, 4096) // Large buffer for high-frequency data
	go func() {
		for msg := range messageBroadcaster {
			// Forward to hub for WebSocket clients (non-blocking)
			select {
			case h.Broadcast <- msg:
			default:
				// Hub channel full, drop message silently
			}

			// Forward to order processor for pending order execution (non-blocking)
			if orderProcessor != nil {
				select {
				case orderProcessor.MessageChannel <- msg:
				default:
					// Order processor busy, skip this update (OK for frequent price updates)
				}
			}
		}
	}()

	// Create a wrapper that sends Binance messages to messageBroadcaster
	// This allows both WebSocket clients AND the order processor to receive price updates
	broadcastWrapper := &hub.Hub{
		Broadcast: messageBroadcaster, // Messages go to broadcaster, which fans out to hub and order processor
		Register:  make(chan *hub.Client), // Dummy channels (not used by Binance streams)
		Unregister: make(chan *hub.Client),
	}

	// Start Binance WebSocket streams for real-time market data
	// Messages are sent to messageBroadcaster which fans out to hub and order processor
	go binance.StreamTrades(broadcastWrapper)
	go binance.StreamDepth(broadcastWrapper)
	log.Println("Binance WebSocket streams started")

	// Initialize forex service using Frankfurter API (free, no API key required)
	forexService := services.NewMassiveService("")
	analyticsHandler := api.NewAnalyticsHandler(forexService)
	fxRatesHandler := api.NewFXRatesHandler(forexService)

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
	// REST handler for bulk FX rates (with CORS and HEAD support for wallet overview)
	http.HandleFunc("/api/v1/fx-rates", api.CORSMiddleware(allowHEAD(fxRatesHandler.HandleFXRates)))
	// REST handler for config: supported currencies (with CORS and HEAD support)
	http.HandleFunc("/api/v1/config/currencies", api.CORSMiddleware(allowHEAD(api.HandleConfigCurrencies)))
	// REST handler for config: product types (with CORS and HEAD support)
	http.HandleFunc("/api/v1/config/product-types", api.CORSMiddleware(allowHEAD(api.HandleConfigProductTypes)))
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
	// GET /api/v1/accounts - List all user's accounts
	http.HandleFunc("/api/v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			// Apply CORS and Auth middleware for POST requests
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateAccount))(w, r)
		case http.MethodGet:
			// Apply CORS and Auth middleware for GET requests
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetAccounts))(w, r)
		case http.MethodOptions:
			// Handle preflight CORS requests
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			// Method not allowed
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// PATCH /api/v1/accounts/metadata?id={uuid} - Update account metadata (nickname, color, icon)
	http.HandleFunc("/api/v1/accounts/metadata", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPatch, http.MethodPost:
			// Apply CORS, Auth, and Rate Limit middleware
			api.CORSMiddleware(middleware.AuthMiddleware(middleware.RateLimitMiddleware(api.UpdateAccountMetadata)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Pending Orders endpoints (protected with JWT authentication + rate limiting)
	// POST /api/v1/pending-orders - Create a new pending limit/stop-limit order
	// GET /api/v1/pending-orders?account_id={uuid} - List pending orders for account
	http.HandleFunc("/api/v1/pending-orders", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(middleware.RateLimitMiddleware(api.CreatePendingOrder)))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetPendingOrders))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// DELETE /api/v1/pending-orders/cancel?id={uuid} - Cancel a pending order
	http.HandleFunc("/api/v1/pending-orders/cancel", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodDelete, http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(middleware.RateLimitMiddleware(api.CancelPendingOrder)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
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
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateTransaction))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetTransactions))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Orders endpoints (protected with JWT authentication)
	// POST /api/v1/orders - Create a new order
	// GET /api/v1/orders?account_id={uuid} - List orders for account
	http.HandleFunc("/api/v1/orders", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateOrder))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetOrders))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/orders/cancel?order_id={uuid} - Cancel an order
	http.HandleFunc("/api/v1/orders/cancel", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(api.CancelOrder))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// History endpoints (protected with JWT authentication)
	// GET /api/v1/history - Batch endpoint for all user history (transactions + orders + pending orders)
	http.HandleFunc("/api/v1/history", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetBatchHistory))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Contracts endpoints (protected with JWT authentication)
	// POST /api/v1/contracts - Open a new position
	// GET /api/v1/contracts?account_id={uuid}&status=open - List contracts
	http.HandleFunc("/api/v1/contracts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(api.CreateContract))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(middleware.AuthMiddleware(api.GetContracts))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/contracts/close?contract_id={uuid} - Close a position
	http.HandleFunc("/api/v1/contracts/close", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(api.CloseContract))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// PATCH /api/v1/contracts/tpsl?contract_id={uuid} - Update TP/SL
	http.HandleFunc("/api/v1/contracts/tpsl", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPatch, http.MethodPost:
			api.CORSMiddleware(middleware.AuthMiddleware(api.UpdateContractTPSL))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
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

// runMigrations runs database migrations using golang-migrate
func runMigrations() error {
	// Get database URL from environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return fmt.Errorf("DATABASE_URL environment variable is not set")
	}

	// Construct migrations path
	migrationsPath := "file://internal/database/migrations"

	// Check if running from cmd/server directory
	if _, err := os.Stat("../../internal/database/migrations"); err == nil {
		migrationsPath = "file://../../internal/database/migrations"
	}

	// Create migration instance
	m, err := migrate.New(migrationsPath, dbURL)
	if err != nil {
		return fmt.Errorf("failed to create migrate instance: %w", err)
	}
	defer m.Close()

	// Run migrations
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Get current version
	version, dirty, err := m.Version()
	if err != nil && err != migrate.ErrNilVersion {
		return fmt.Errorf("failed to get migration version: %w", err)
	}

	if dirty {
		log.Printf("WARNING: Database is in dirty state at version %d", version)
	} else {
		log.Printf("Database is at migration version: %d", version)
	}

	return nil
}
