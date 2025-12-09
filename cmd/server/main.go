package main

import (
	"brokerageProject/internal/api"
	"brokerageProject/internal/binance"
	"brokerageProject/internal/config"
	"brokerageProject/internal/database"
	"brokerageProject/internal/hub"
	redisInfra "brokerageProject/internal/infrastructure/redis"
	redisProvider "brokerageProject/internal/market_data/redis"
	"brokerageProject/internal/middleware"
	"brokerageProject/internal/mt5client"
	"brokerageProject/internal/services"
	"brokerageProject/internal/utils"
	"brokerageProject/internal/worker"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
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

	// Initialize market data configuration after loading .env
	config.InitMarketDataConfig()
	log.Printf("Market data config initialized (Hybrid: Binance + Redis/MT5)")

	// Log Stripe configuration status (without revealing the key)
	if stripeKey := os.Getenv("STRIPE_SECRET_KEY"); stripeKey != "" {
		log.Printf("STRIPE_SECRET_KEY loaded successfully (length: %d)", len(stripeKey))
	} else {
		log.Println("WARNING: STRIPE_SECRET_KEY is not set!")
	}

	// Validate JWT_SECRET for custom authentication
	if jwtSecret := os.Getenv("JWT_SECRET"); jwtSecret != "" {
		log.Printf("JWT_SECRET loaded successfully (length: %d)", len(jwtSecret))
		if len(jwtSecret) < 32 {
			log.Println("WARNING: JWT_SECRET should be at least 32 characters for security!")
		}
	} else {
		log.Fatalf("CRITICAL: JWT_SECRET is not set! Custom authentication requires JWT_SECRET.")
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

	// Run database migrations (optional - enable if DATABASE_MIGRATION_URL is set)
	// Use DATABASE_MIGRATION_URL for direct PostgreSQL connection (port 5432)
	// Supports both local PostgreSQL and cloud-hosted instances
	if os.Getenv("DATABASE_MIGRATION_URL") != "" {
		if err := runMigrations(); err != nil {
			log.Printf("WARNING: Migration error: %v", err)
			log.Println("Continuing with existing schema...")
		} else {
			log.Println("Database migrations completed successfully")
		}
	} else {
		log.Println("DATABASE_MIGRATION_URL not set - skipping automatic migrations")
		log.Println("To enable: Set DATABASE_MIGRATION_URL to session pooler (port 5432)")
	}

	// Initialize audit logger (requires database)
	dbPool, err := database.GetPool()
	if err != nil {
		log.Fatalf("CRITICAL: Failed to get database pool: %v", err)
	}
	utils.InitGlobalAuditLogger(dbPool)

	// Initialize margin service (requires database)
	marginService := services.GetGlobalMarginService()
	marginService.InitMarginService(dbPool)
	log.Println("Margin service initialized successfully")

	// Initialize Redis client using centralized infrastructure
	// Redis is optional - app can run without it (with limited functionality)
	var redisClient *redis.Client
	if err := redisInfra.InitClientFromEnv(); err != nil {
		log.Printf("WARNING: Failed to initialize Redis: %v", err)
		log.Println("WARNING: Running without Redis - some features will be disabled:")
		log.Println("  - OTP verification for password reset will not work")
		log.Println("  - Rate limiting will be disabled")
		log.Println("  - Session revocation will be disabled")
		log.Println("  - Forex real-time data streaming will be disabled")
		log.Println("To fix: Start Redis with 'docker compose up -d redis' or install Redis locally")
		redisClient = nil
	} else {
		redisClient = redisInfra.GetClient()
		defer redisInfra.CloseClient()
		log.Println("Redis client initialized successfully")
	}

	// Initialize auth storage service (Redis-backed OTP, reset tokens, rate limiting, session revocation)
	// Will be nil if Redis is unavailable - auth handlers will need to handle this
	var authStorage *services.AuthStorageService
	if redisClient != nil {
		authStorage = services.NewAuthStorageService(redisClient)
		log.Println("Auth storage service initialized (Redis-backed)")
	} else {
		authStorage = nil
		log.Println("WARNING: Auth storage service disabled (Redis unavailable)")
	}

	// Initialize email sender based on environment
	var emailSender services.EmailSender
	environment := os.Getenv("ENVIRONMENT")
	if environment == "production" {
		resendAPIKey := os.Getenv("RESEND_API_KEY")
		emailFromAddress := os.Getenv("EMAIL_FROM_ADDRESS")
		if resendAPIKey == "" || emailFromAddress == "" {
			log.Fatal("FATAL: RESEND_API_KEY and EMAIL_FROM_ADDRESS must be set in production environment")
		}
		var err error
		emailSender, err = services.NewResendSender(resendAPIKey, emailFromAddress)
		if err != nil {
			log.Fatalf("FATAL: Failed to initialize Resend email sender: %v", err)
		}
	} else {
		emailSender = services.NewConsoleSender()
	}
	log.Printf("Email sender initialized (Environment: %s)", environment)

	// Define forex symbols (used by multiple services)
	forexSymbols := []string{"EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "NZDUSD", "USDCHF", "CADJPY", "AUDNZD", "EURGBP", "USDCAD", "EURJPY", "GBPJPY"}

	// Initialize forex services (if Redis is available)
	var forexAggregator *services.ForexAggregatorService
	var forexAnalytics *services.ForexAnalyticsService
	var forexKlines *services.ForexKlinesService

	if redisClient != nil {
		// Initialize forex aggregator (tick → 1-minute bars)
		forexAggregator = services.NewForexAggregatorService(dbPool, redisClient)
		go forexAggregator.StartAggregator(context.Background())
		log.Println("Forex aggregator service started (subscribing to fx_price_updates)")

		// Initialize forex analytics (24h stats calculator)
		forexAnalytics = services.NewForexAnalyticsService(dbPool, redisClient)
		go forexAnalytics.StartAnalyticsWorker(context.Background())
		log.Println("Forex analytics worker started (Redis-based calculations every 5 minutes)")

		// Initialize forex klines service (historical data provider)
		forexKlines = services.NewForexKlinesService(dbPool, redisClient)
		log.Println("Forex klines service initialized (with Redis caching for aggregated intervals)")
	} else {
		log.Println("WARNING: Forex services disabled (Redis unavailable)")
	}

	// Initialize Data Integrity Service (gap detection and automatic backfill)
	windowsAPIURL := os.Getenv("WINDOWS_API_URL")

	// Only use default in local non-Docker development
	if windowsAPIURL == "" && os.Getenv("DOCKER_ENV") == "" && os.Getenv("ENVIRONMENT") != "production" {
		log.Println("WARNING: WINDOWS_API_URL not set, using default http://localhost:5000 for local development")
		windowsAPIURL = "http://localhost:5000"
	}

	if windowsAPIURL != "" && redisClient != nil {
		log.Printf("Initializing Data Integrity Service with MT5 API at %s", windowsAPIURL)

		mt5Client := mt5client.NewClient(mt5client.Config{
			BaseURL:    windowsAPIURL,
			Timeout:    30 * time.Second,
			MaxRetries: 3,
		})

		dataIntegrityService := services.NewDataIntegrityService(services.DataIntegrityConfig{
			DB:             dbPool,
			MT5Client:      mt5Client,
			TrackedSymbols: forexSymbols,
			CheckSchedule:  "0 * * * *", // Run every hour at minute 0
			GapWindow:      2 * time.Minute,
			MaxBackoff:     1 * time.Hour,
		})

		if err := dataIntegrityService.Start(context.Background()); err != nil {
			log.Printf("WARNING: Data Integrity Service failed to start: %v", err)
		} else {
			log.Println("Data Integrity Service started (gap detection every hour)")
		}
	} else {
		if windowsAPIURL == "" {
			log.Println("INFO: Data Integrity Service disabled (WINDOWS_API_URL not configured)")
		} else {
			log.Println("WARNING: Data Integrity Service disabled (Redis unavailable)")
		}
	}

	// Initialize Partition Manager Service (automated partition lifecycle management)
	// OPTIMIZATION: Automatically manages 3-month retention policy for forex_klines_1m
	// This prevents long-term data accumulation and reduces storage/egress costs
	partitionManager := services.NewPartitionManagerService(services.PartitionManagerConfig{
		DB:              dbPool,
		Archiver:        nil,         // Optional: Configure S3/MinIO archiver if needed for partition archival
		RetentionMonths: 3,           // Keep last 3 months of data (user-selected)
		PreCreateMonths: 1,           // Pre-create 1 month ahead
		Schedule:        "0 0 * * *", // Run daily at midnight UTC (more aggressive than default monthly)
	})

	if err := partitionManager.Start(context.Background()); err != nil {
		log.Printf("WARNING: Partition Manager failed to start: %v", err)
	} else {
		log.Println("Partition Manager Service started (3-month retention, daily checks)")
	}

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

	// Subscribe hub to Redis forex price updates (if Redis available)
	if redisClient != nil {
		go h.SubscribeToRedisForex(context.Background(), redisClient)
	}

	// Initialize event-driven order processor (requires database and hub)
	var orderProcessor *worker.OrderProcessor
	if dbPool, err := database.GetPool(); err == nil {
		orderProcessor = worker.NewOrderProcessor(dbPool, h)
		go orderProcessor.Run()
		log.Println("Order processor initialized with WebSocket notification support")
	} else {
		log.Println("WARNING: Order processor disabled (database not available)")
	}

	// Create message broadcaster that fans out to both hub and order processor
	// This allows both WebSocket clients and the order processor to receive real-time price updates
	messageBroadcaster := make(chan []byte, 256) // Small buffer with rate limiting in place
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

	// HYBRID MARKET DATA ENGINE: Real-Time Crypto (Binance) + Real-Time Forex (MT5/Redis)
	// Initialize market data service using the Provider interface pattern
	marketDataService, err := services.NewMarketDataService(messageBroadcaster)
	if err != nil {
		log.Fatalf("CRITICAL: Failed to initialize market data service: %v", err)
	}

	// Initialize with static prices immediately (for instant UI responsiveness)
	marketDataService.InitializeWithStaticPrices(config.StaticPrices)

	// Provider 1: Binance WebSocket (Real-Time Crypto)
	binanceProvider := binance.NewProvider()
	marketDataService.AddProvider(binanceProvider)
	log.Println("Registered Binance Provider (real-time crypto WebSocket)")

	// Provider 2: Redis Pub/Sub (Real-Time Forex from MT5)
	// Get Redis connection details from environment for forex provider
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	redisPassword := os.Getenv("REDIS_PASSWORD")
	redisForexProvider := redisProvider.NewProvider(redisAddr, redisPassword)
	marketDataService.AddProvider(redisForexProvider)
	log.Printf("Registered Redis Provider (real-time forex from MT5, addr=%s)", redisAddr)

	// Start all providers
	// Crypto symbols are handled by Binance provider (ignored by Redis)
	// Forex symbols are handled by Redis provider (ignored by Binance)
	// Forex list: All forex pairs supported by MT5 Publisher
	if err := marketDataService.Start(forexSymbols); err != nil {
		log.Printf("WARNING: Market data service failed to start: %v", err)
	} else {
		log.Println("Market data service started successfully (Hybrid Engine: Crypto + Forex)")
	}

	// Start Binance order book depth stream for market activity display
	// Provides 20-level order book data at 100ms intervals for crypto symbols
	// Routes through messageBroadcaster to reach both WebSocket clients and order processor
	go binance.StreamDepth(&hub.Hub{
		Broadcast:  messageBroadcaster,
		Register:   make(chan *hub.Client), // Unused dummy channel
		Unregister: make(chan *hub.Client), // Unused dummy channel
	})
	log.Println("Binance order book depth stream started (20 levels @ 100ms)")

	// Start Binance trades stream for market activity display
	// Provides full trade data (price, quantity, time, isBuyerMaker) for crypto symbols
	// NOTE: BinanceProvider also streams trades but only sends price ticks (onTick callback)
	//       This separate stream provides complete trade data for market trades tab
	//       Frontend throttling (100ms) prevents duplicate price updates from causing issues
	go binance.StreamTrades(&hub.Hub{
		Broadcast:  messageBroadcaster,
		Register:   make(chan *hub.Client), // Unused dummy channel
		Unregister: make(chan *hub.Client), // Unused dummy channel
	})
	log.Println("Binance trades stream started (for market trades display)")

	// Initialize forex service using Frankfurter API (free, no API key required)
	forexService := services.NewMassiveService("")
	analyticsHandler := api.NewAnalyticsHandler(forexService)
	fxRatesHandler := api.NewFXRatesHandler(forexService)

	// Initialize crypto exchange rate service with regular refresh
	// Supports 40+ cryptocurrencies with updates every 5 minutes
	// Using 5-minute interval to stay within CoinGecko free API rate limits (10-50 calls/min)
	defaultCryptoSymbols := []string{
		"BTC", "ETH", "BNB", "SOL", "ADA", "XRP", "AVAX", "MATIC", "LINK", "UNI", "ATOM", "DOT",
		"ARB", "OP", "APT", "DOGE", "LTC", "SHIB", "NEAR", "ICP", "FIL", "SUI", "STX", "TON",
		"USDT", "USDC", "DAI", "TRX", "ETC", "XLM", "ALGO", "VET", "THETA", "EOS", "AAVE", "GRT",
		"AXS", "MANA", "SAND", "ENJ", "CHZ", "HBAR", "FLOW", "EGLD", "ZIL", "WAVES", "XTZ", "BAT",
	}
	exchangeRateService := services.NewExchangeRateService(defaultCryptoSymbols, 5*time.Minute)
	exchangeRateHandler := api.NewExchangeRateHandler(exchangeRateService)

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
	// REST handler for crypto exchange rates (with CORS and HEAD support)
	http.HandleFunc(config.ExchangeRateAPIPath, api.CORSMiddleware(allowHEAD(exchangeRateHandler.HandleGetRates)))

	// ========== EXTERNAL API PROXY ENDPOINTS ==========

	// Binance klines proxy (for chart candlestick data)
	http.HandleFunc("/api/v1/proxy/binance/klines", api.CORSMiddleware(allowHEAD(api.ProxyBinanceKlines)))

	// Exchange rates proxy (backup for ExchangeRateService)
	http.HandleFunc("/api/v1/proxy/exchange-rates", api.CORSMiddleware(allowHEAD(api.ProxyExchangeRates)))

	// ========== AUTHENTICATION ENDPOINTS (Public - No Auth Required) ==========

	// POST /api/v1/auth/register - User registration (creates pending_registrations record)
	http.HandleFunc("/api/v1/auth/register", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.IPRateLimitMiddleware(100, 20)(api.HandleRegister))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/auth/login - User login (verifies pending_registrations status, creates user if approved)
	http.HandleFunc("/api/v1/auth/login", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.IPRateLimitMiddleware(100, 20)(api.HandleLogin))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/auth/check-status - Check registration approval status
	http.HandleFunc("/api/v1/auth/check-status", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.IPRateLimitMiddleware(100, 20)(api.HandleCheckStatus))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/auth/forgot-password - Request password reset OTP (with rate limiting)
	http.HandleFunc("/api/v1/auth/forgot-password", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.IPRateLimitMiddleware(100, 20)(api.HandleForgotPassword(authStorage, emailSender)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/auth/verify-otp - Verify OTP and get reset token
	http.HandleFunc("/api/v1/auth/verify-otp", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.IPRateLimitMiddleware(100, 20)(api.HandleVerifyOTP(authStorage)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/auth/reset-password - Reset password with token (with session revocation)
	http.HandleFunc("/api/v1/auth/reset-password", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(middleware.IPRateLimitMiddleware(100, 20)(api.HandleResetPassword(authStorage)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Create auth middleware factory with session revocation
	authMiddleware := middleware.NewAuthMiddleware(authStorage)

	// POST /api/v1/auth/change-password - Change password (authenticated, with session revocation)
	http.HandleFunc("/api/v1/auth/change-password", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(api.HandleChangePassword(authStorage)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// ========== ACCOUNT ACTIVATION ENDPOINTS (Protected - Auth Required) ==========

	// POST /api/v1/accounts/{account_id}/activate - Activate/switch to specific account
	http.HandleFunc("/api/v1/accounts/", func(w http.ResponseWriter, r *http.Request) {
		// Check if the path ends with /activate
		if r.Method == http.MethodPost && len(r.URL.Path) > len("/api/v1/accounts/") {
			// This handles /api/v1/accounts/{account_id}/activate
			if r.URL.Path[len(r.URL.Path)-9:] == "/activate" {
				api.CORSMiddleware(authMiddleware(api.HandleActivateAccount))(w, r)
				return
			}
		}
		if r.Method == http.MethodOptions {
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	})

	// POST /api/v1/accounts/deactivate-all - Deactivate all user accounts (logout)
	http.HandleFunc("/api/v1/accounts/deactivate-all", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(api.HandleDeactivateAllAccounts))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Account management endpoints (protected with JWT authentication)
	// POST /api/v1/accounts - Create a new trading account
	// GET /api/v1/accounts - List all user's accounts
	http.HandleFunc("/api/v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			// Apply CORS and Auth middleware for POST requests
			api.CORSMiddleware(authMiddleware(api.CreateAccount))(w, r)
		case http.MethodGet:
			// Apply CORS and Auth middleware for GET requests
			api.CORSMiddleware(authMiddleware(api.GetAccounts))(w, r)
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
			api.CORSMiddleware(authMiddleware(middleware.RateLimitMiddleware(api.UpdateAccountMetadata)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/accounts/toggle-status?account_id={uuid} - Toggle account status (active/deactivated/suspended)
	http.HandleFunc("/api/v1/accounts/toggle-status", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(middleware.RateLimitMiddleware(api.ToggleAccountStatus)))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/accounts/demo/edit-balance - Edit demo account balance (demo accounts only)
	http.HandleFunc("/api/v1/accounts/demo/edit-balance", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(middleware.RateLimitMiddleware(api.EditDemoBalance)))(w, r)
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
			api.CORSMiddleware(authMiddleware(middleware.RateLimitMiddleware(api.CreatePendingOrder)))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(authMiddleware(api.GetPendingOrders))(w, r)
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
			api.CORSMiddleware(authMiddleware(middleware.RateLimitMiddleware(api.CancelPendingOrder)))(w, r)
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

	// Forex endpoints (public - no auth required, cache-first design)
	if redisClient != nil && forexKlines != nil {
		// GET /api/v1/forex/quotes - All forex pair quotes with 24h stats
		http.HandleFunc("/api/v1/forex/quotes", api.CORSMiddleware(allowHEAD(api.HandleForexQuotes(redisClient))))
		// GET /api/v1/forex/klines?symbol=EURUSD&interval=1h&limit=100 - Historical klines
		http.HandleFunc("/api/v1/forex/klines", api.CORSMiddleware(allowHEAD(api.HandleForexKlines(forexKlines, redisClient))))
		log.Println("Forex API endpoints registered: /api/v1/forex/quotes, /api/v1/forex/klines")
	}

	// Transactions endpoints (protected with JWT authentication)
	// POST /api/v1/transactions - Create transaction (deposit/withdrawal/transfer)
	// GET /api/v1/transactions?account_id={uuid} - List transactions for account
	http.HandleFunc("/api/v1/transactions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(api.CreateTransaction))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(authMiddleware(api.GetTransactions))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// Deposits endpoints (protected with JWT authentication)
	// POST /api/v1/deposits - Create deposit request
	// GET /api/v1/deposits?account_id={uuid} - List deposits for account
	http.HandleFunc("/api/v1/deposits", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(api.CreateDeposit))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(authMiddleware(api.GetDeposits))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/deposits/:id/receipt - Upload payment receipt for deposit
	http.HandleFunc("/api/v1/deposits/", func(w http.ResponseWriter, r *http.Request) {
		// Check if this is a receipt upload request
		if strings.Contains(r.URL.Path, "/receipt") {
			switch r.Method {
			case http.MethodPost:
				api.CORSMiddleware(authMiddleware(api.UploadReceipt))(w, r)
			case http.MethodOptions:
				api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
				})(w, r)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	})

	// Orders endpoints (protected with JWT authentication)
	// POST /api/v1/orders - Create a new order
	// GET /api/v1/orders?account_id={uuid} - List orders for account
	http.HandleFunc("/api/v1/orders", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(api.CreateOrder))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(authMiddleware(api.GetOrders))(w, r)
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
			api.CORSMiddleware(authMiddleware(api.CancelOrder))(w, r)
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
			api.CORSMiddleware(authMiddleware(api.GetBatchHistory))(w, r)
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
			api.CORSMiddleware(authMiddleware(api.CreateContract))(w, r)
		case http.MethodGet:
			api.CORSMiddleware(authMiddleware(api.GetContracts))(w, r)
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
			api.CORSMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
				api.CloseContract(h, w, r)
			}))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// POST /api/v1/contracts/close-pair?pair_id={uuid} - Close both positions in a hedged pair
	http.HandleFunc("/api/v1/contracts/close-pair", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			api.CORSMiddleware(authMiddleware(func(w http.ResponseWriter, r *http.Request) {
				api.ClosePair(h, w, r)
			}))(w, r)
		case http.MethodOptions:
			api.CORSMiddleware(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			})(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	// GET /api/v1/contracts/history?account_id={uuid} - Get closed/liquidated positions
	http.HandleFunc("/api/v1/contracts/history", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			api.CORSMiddleware(authMiddleware(api.GetContractHistory))(w, r)
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
			api.CORSMiddleware(authMiddleware(api.UpdateContractTPSL))(w, r)
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
	// Cloud Deployment: Always use HTTP on 0.0.0.0 (SSL handled by reverse proxy: Nginx/Caddy/Fly.io)
	// Local Docker Dev: Use HTTPS with mkcert certificates on 0.0.0.0

	// Check if running in local Docker development (docker-compose.yml sets DOCKER_ENV=development)
	// In cloud deployments (Fly.io, Contabo, etc.), this variable is NOT set
	isLocalDockerDev := os.Getenv("DOCKER_ENV") == "development"

	// Check if running in cloud deployment (Fly.io sets FLY_APP_NAME)
	isCloudDeployment := os.Getenv("FLY_APP_NAME") != ""

	if isCloudDeployment {
		// Cloud Deployment: Use HTTP on 0.0.0.0 (required by cloud providers)
		// SSL is handled by reverse proxy (Fly.io edge, Nginx, Caddy, etc.)
		bindAddr := "0.0.0.0" + serverAddress
		log.Printf("Cloud deployment detected - starting HTTP server on %s", bindAddr)
		log.Println("Note: SSL is handled by cloud provider or reverse proxy")
		log.Fatal(http.ListenAndServe(bindAddr, nil))
	}

	// Local Development (Docker or native): Check for HTTPS certificates
	var certFile, keyFile string

	// Check if running in Docker (DOCKER_ENV or HTTPS_ENABLED set)
	dockerEnv := os.Getenv("DOCKER_ENV")
	httpsEnabled := os.Getenv("HTTPS_ENABLED")

	if dockerEnv != "" || httpsEnabled != "" {
		// Docker environment - check /app/certs/ directory
		certFile = "/app/certs/localhost+2.pem"
		keyFile = "/app/certs/localhost+2-key.pem"
		log.Println("Docker environment detected - looking for certificates in /app/certs/")
	} else {
		// Local development - check project root (../../ from cmd/server)
		certFile = filepath.Join("..", "..", "localhost+2.pem")
		keyFile = filepath.Join("..", "..", "localhost+2-key.pem")
		log.Println("Local environment detected - looking for certificates in project root")
	}

	// Check if certificate files exist
	if _, certErr := os.Stat(certFile); certErr == nil {
		if _, keyErr := os.Stat(keyFile); keyErr == nil {
			// Certificates found - start HTTPS server
			log.Printf("✓ SSL certificates found at %s", certFile)

			// Bind to 0.0.0.0 in Docker (required for inter-container communication)
			// Bind to localhost for native development (more secure)
			var bindAddr string
			if isLocalDockerDev {
				bindAddr = "0.0.0.0" + serverAddress
				log.Printf("Starting HTTPS server on https://0.0.0.0%s (Docker mode)", serverAddress)
				log.Println("Note: Accessible via https://backend:8080 from other containers")
			} else {
				bindAddr = serverAddress // defaults to localhost
				log.Printf("Starting HTTPS server on https://localhost%s", serverAddress)
				log.Println("Note: These are mkcert-generated certificates for local development")
			}
			log.Fatal(http.ListenAndServeTLS(bindAddr, certFile, keyFile, nil))
		}
	}

	// No certificates found - start HTTP server
	if isLocalDockerDev {
		// Docker dev without certificates - bind to 0.0.0.0
		bindAddr := "0.0.0.0" + serverAddress
		log.Printf("No SSL certificates found - starting HTTP server on http://0.0.0.0%s (Docker mode)", serverAddress)
		log.Fatal(http.ListenAndServe(bindAddr, nil))
	} else {
		// Native development - bind to localhost
		log.Printf("No SSL certificates found - starting HTTP server on http://localhost%s", serverAddress)
		log.Println("Tip: For HTTPS in development, generate certificates with mkcert")
		log.Fatal(http.ListenAndServe(serverAddress, nil))
	}
}

// runMigrations runs database migrations using golang-migrate
func runMigrations() error {
	// Get database URL from environment
	// Use DATABASE_MIGRATION_URL if available (session pooler), otherwise use DATABASE_URL
	// Session pooler (port 5432) is required for migrations (not transaction pooler on port 6543)
	dbURL := os.Getenv("DATABASE_MIGRATION_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
		if dbURL == "" {
			return fmt.Errorf("DATABASE_URL environment variable is not set")
		}
		// Remove pgbouncer parameter from URL if present (migrations need session mode)
		dbURL = strings.Replace(dbURL, "?pgbouncer=true", "", 1)
		log.Println("Note: Using DATABASE_URL for migrations. For best results, set DATABASE_MIGRATION_URL to session pooler (port 5432)")
	} else {
		log.Println("Using DATABASE_MIGRATION_URL for migrations (session pooler mode)")
	}

	// Construct migrations path
	migrationsPath := "file://sql-scripts/migrations"

	// Check if running from cmd/server directory
	if _, err := os.Stat("../../sql-scripts/migrations"); err == nil {
		migrationsPath = "file://../../sql-scripts/migrations"
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
