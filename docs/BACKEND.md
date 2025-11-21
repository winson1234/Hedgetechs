# Backend Documentation

## Overview

Go-based HTTP and WebSocket server providing real-time market data streaming from multiple sources (Binance WebSocket + MT5 via Redis), database-backed trading operations with PostgreSQL, CFD and margin trading support, order processing, historical data, multi-source news aggregation, forex analytics, and Stripe payment processing.

**Tech:** Go 1.23, gorilla/websocket, pgx (PostgreSQL), go-redis, go-cache, golang-migrate, net/http, Stripe API, TwelveData API

---

## Architecture

```
Market Data Layer (Hybrid Provider Pattern):
├─ Binance Provider → Binance WebSocket → Hub → WebSocket Clients
└─ Redis Provider → Redis Pub/Sub (MT5 Publisher) → Hub → WebSocket Clients

Database Layer (PostgreSQL):
├─ Trading accounts, balances, positions
├─ Orders (pending + executed)
├─ Contracts (CFD positions)
├─ Audit logs & reconciliation queue
└─ LP routing configuration

Services Layer:
├─ Market Data Service (manages providers)
├─ Margin Service (leverage calculations)
├─ Order Processor (event-driven execution)
└─ Audit Logger (database-backed)

HTTP/WebSocket Layer:
HTTP Handlers → CORS Middleware → Database/Cache → External APIs
                                                   ↓
                                        Stripe/TwelveData/RSS
```

---

## Core Components

### main.go
- Entry point for the application
- Loads environment variables from `.env`
- Initializes PostgreSQL connection pool (pgx, 25 max connections)
- Runs database migrations (golang-migrate)
- Initializes Redis client with password authentication
- Creates Hub and starts it in goroutine
- Initializes market data providers:
  - Binance Provider (crypto: BTCUSDT, ETHUSDT, SOLUSDT)
  - Redis Provider (forex: 9 pairs from MT5)
- Starts Market Data Service with both providers
- Initializes services (margin, order processor, audit logger)
- Initializes Stripe with secret key
- Registers HTTP/WebSocket handlers with CORS middleware
- HEAD request support for health checks
- Starts server on port from `PORT` env var (fallback: `8080`)

### hub/hub.go
**Purpose:** WebSocket client management and broadcasting

**Key Functions:**
- `NewHub()` - Creates hub with channels
- `Run()` - Handles client registration/unregistration and broadcasting
- `Broadcast(message)` - Sends message to all connected clients

### database/database.go
**Purpose:** PostgreSQL connection management

**Key Functions:**
- `NewDatabase(databaseURL)` - Creates pgx connection pool
- Connection pooling (25 max connections, 5 min idle timeout)
- Health check ping
- Graceful shutdown with context cancellation

**Database Organization:**
- Connection pool: `internal/database/` (pgx)
- Migrations: `sql-scripts/migrations/` (golang-migrate)
- Schema: `sql-scripts/schema/` (modular table/type definitions)
- Run migrations: `migrate -path sql-scripts/migrations -database $DATABASE_URL up`
- See `docs/DATABASE.md` for complete schema documentation

### market_data/provider.go
**Purpose:** Provider interface for extensible market data sources

**Interface:**
```go
type Provider interface {
    Subscribe(symbols []string, onTick func(symbol string, price float64)) error
    Close() error
}
```

**Implementations:**
- Binance Provider (`market_data/binance/provider.go`) - WebSocket streams for crypto
- Redis Provider (`market_data/redis/provider.go`) - Pub/Sub for forex from MT5

### market_data/binance/provider.go
**Purpose:** Binance WebSocket provider implementation

**Features:**
- Implements Provider interface
- Subscribes to Binance trade stream for crypto symbols
- Auto-reconnect with exponential backoff (1s → 60s max)
- Broadcasts price updates via callback function
- Thread-safe operation

### market_data/redis/provider.go
**Purpose:** Redis Pub/Sub provider for MT5 forex data

**Features:**
- Implements Provider interface
- Subscribes to Redis channel: `fx_price_updates`
- Seeds initial prices from Redis hash: `fx_latest_prices`
- Password authentication support
- Supports 9 forex pairs (EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD, EURJPY, GBPJPY, AUDNZD)
- Parses bid/ask prices and calculates mid-price
- Auto-reconnect on connection failures

### services/market_data_service.go
**Purpose:** Central market data service managing multiple providers

**Key Functions:**
- `AddProvider(p Provider)` - Registers new provider
- `Subscribe(symbols []string)` - Subscribes to symbols across all providers
- `onPriceTick(symbol, price)` - Callback for price updates, broadcasts to Hub
- Manages provider lifecycle

### services/margin_service.go
**Purpose:** Margin and leverage calculations for CFD trading

**Key Functions:**
- Calculate margin requirement for position
- Calculate margin level (equity / margin * 100)
- Validate leverage limits (1x to 500x)
- Monitor margin calls (typically < 100% margin level)
- Liquidation threshold checking

### services/order_processor.go
**Purpose:** Event-driven order execution processor

**Key Functions:**
- Monitors pending orders in database
- Checks trigger conditions (price >= limit, price <= stop)
- Executes orders when conditions met
- Updates database (moves to `orders` table, removes from `pending_orders`)
- Creates contracts for CFD positions
- Sends WebSocket notifications to frontend

### services/audit_logger.go
**Purpose:** Database-backed audit logging for compliance

**Key Functions:**
- Logs all trading operations to `audit_logs` table
- Records user actions, timestamps, IP addresses
- Immutable append-only log
- Used for compliance and debugging

### api/handlers.go
**Main Handlers:**

#### HandleWebSocket(h *hub.Hub, w, r)
- Upgrades HTTP to WebSocket with CORS support
- Creates client with send channel
- Registers client with hub
- Starts read/write goroutines for bidirectional communication

#### HandleKlines(w, r)
**Query:** `symbol`, `interval`, `limit`  
**Cache:** 5 minutes  
**Source:** Binance REST API  
**Returns:** Historical candlestick data (OHLCV)

#### HandleTicker(w, r)
**Query:** `symbols` (comma-separated)  
**Cache:** 10 seconds  
**Source:** Binance 24h ticker API  
**Returns:** 24h ticker statistics (price, volume, high, low, change)

#### HandleNews(w, r)
**Cache:** 2 minutes  
**Sources:** CoinDesk, CryptoNews, CoinTelegraph, FXStreet, Investing.com, Yahoo Finance  
**Logic:** Concurrent RSS fetching, XML parsing, time-based sorting  
**Returns:** Aggregated news articles with titles, links, descriptions, timestamps

#### HandleAnalytics(w, r) - analytics_handler.go
**Query:** `type` (fx_rate, rsi, sma, ema, macd), `from`, `to`, `symbol`, `period`
**Cache:** 15 minutes
**Source:** TwelveData API (forex market data with API key)
**Returns:** Technical indicators or forex conversion rates

#### HandleCreatePaymentIntent(w, r) - payment_handler.go
**Method:** POST
**Body:** `amount`, `currency`, `payment_method_types` (optional), `metadata`
**Source:** Stripe API
**Logic:**
- If `payment_method_types` provided → use specified types
- If omitted → use automatic payment methods (enables all activated methods in Stripe dashboard)
**Returns:** Payment intent with client secret for frontend confirmation

#### HandlePaymentStatus(w, r) - payment_handler.go
**Query:** `payment_intent_id`  
**Source:** Stripe API  
**Returns:** Payment status and metadata for balance updates

#### HandleGetRates(w, r) - exchange_rate_handler.go
**Query:** `symbols` (optional, comma-separated, e.g., `BTC,ETH,SOL`)  
**Cache:** 30 seconds  
**Source:** CoinGecko API  
**Returns:** JSON object with crypto-to-USD rates: `{ "BTC": 53260.20, "ETH": 2850.50, "USD": 1 }`  
**Headers:** 
- `X-Rates-Timestamp`: ISO 8601 timestamp of data fetch
- `X-Rate-Source`: `live` or `cache` (indicates if using cached/stale data)
- `Cache-Control`: `public, max-age=30`

### api/middleware.go
**CORS Middleware:**
- Allows requests from `*.pages.dev` (Cloudflare Pages)
- Allows localhost for development
- Sets Access-Control headers
- Handles OPTIONS preflight requests
- Origin validation with suffix checking

### services/twelvedata_service.go
**TwelveData Forex Service:**
- Forex market data API with API key (`TWELVE_DATA_API_KEY`)
- Currency conversion and historical data
- Technical indicators support
- 15-minute caching
- HTTP client with 10s timeout

### services/exchange_rate_service.go
**CoinGecko Crypto Exchange Rate Service:**
- Fetches live crypto-to-USD exchange rates from CoinGecko API
- Supports 40+ cryptocurrencies (BTC, ETH, SOL, ADA, XRP, USDT, USDC, and more)
- Background refresh every 30 seconds
- In-memory caching with 30-second expiration
- Fallback to last known rates if API fails
- Query parameter support: `?symbols=BTC,ETH,SOL` (comma-separated)
- Returns JSON: `{ "BTC": 53260.20, "ETH": 2850.50, "USD": 1 }`
- Always includes USD base rate (1.0)

### config/config.go
**Constants:**
- Binance WebSocket URLs (combined trade + depth streams for 4 symbols)
- Binance REST URLs (klines, 24h ticker)
- RSS feed URLs (6 sources: crypto + forex)
- Local server paths for all endpoints

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ws` | WebSocket | Real-time price and order book updates (crypto + forex) |
| `/api/v1/klines` | GET | Historical candlestick data (OHLCV) |
| `/api/v1/ticker` | GET | 24h ticker statistics |
| `/api/v1/news` | GET | Aggregated news from 6 RSS sources |
| `/api/v1/analytics` | GET | Forex rates and technical indicators (TwelveData) |
| `/api/v1/exchange-rate` | GET | Crypto-to-USD exchange rates (40+ cryptocurrencies) |
| `/api/v1/deposit/create-payment-intent` | POST | Stripe payment intent creation |
| `/api/v1/payment/status` | GET | Stripe payment status verification |
| `/api/v1/accounts` | GET | User trading accounts from database |
| `/api/v1/accounts` | POST | Create new trading account |
| `/api/v1/orders` | GET | Pending orders from database |
| `/api/v1/orders` | POST | Create new order (market, limit, stop-limit) |
| `/api/v1/orders/:id` | DELETE | Cancel pending order |
| `/api/v1/positions` | GET | Open CFD positions from database |
| `/api/v1/positions/:id` | PUT | Modify position (add margin, set stop loss) |
| `/api/v1/positions/:id` | DELETE | Close CFD position |

---

## Caching

| Data | Duration | Key Format |
|------|----------|------------|
| Klines | 5 min | `kline-{symbol}-{interval}-{limit}` |
| Ticker | 10 sec | `{symbol1},{symbol2},...` |
| News | 2 min | `all_news` |
| Analytics | 15 min | Varies by request type |
| TwelveData Forex | 15 min | `fx_rate_{from}_{to}` |
| Crypto Exchange Rates | 30 sec | `exchange_rate_{symbol1}_{symbol2}_...` |

**Database Queries:**
- Accounts, orders, and positions are NOT cached
- Queried directly from PostgreSQL for data consistency
- Real-time updates via WebSocket when data changes

---

## Development

### Prerequisites
```bash
# Start Docker services (Redis + MT5 bridge)
docker-compose up -d

# Run database migrations (use DATABASE_MIGRATION_URL for session mode)
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL up

# Check migration version
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL version
```

### Backend Commands
```bash
go mod tidy                     # Install dependencies
go build ./cmd/server           # Build binary
cd cmd/server; go run main.go   # Run server (auto-detects HTTPS certificates)
go test ./...                   # Run all tests
go test -v ./internal/api       # Test handlers with verbose output
go test -cover ./...            # Run with coverage report
```

### Database Migrations
```bash
# Create new migration
migrate create -ext sql -dir sql-scripts/migrations -seq description_here

# Run migrations up (use DATABASE_MIGRATION_URL for session pooler on port 5432)
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL up

# Rollback last migration
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL down 1

# Force version (if dirty)
migrate -path sql-scripts/migrations -database $DATABASE_MIGRATION_URL force VERSION
```

**Connection Modes:**
- `DATABASE_URL` (port 6543 + `?pgbouncer=true`) = Transaction pooling for application queries
- `DATABASE_MIGRATION_URL` (port 5432, no parameters) = Session pooling for migrations

**Database Organization:** See `docs/DATABASE.md` for complete schema documentation and modular sql-scripts/ structure.

**HTTPS Setup:** Server automatically detects `localhost+2.pem` and `localhost+2-key.pem` in project root and starts HTTPS server. See [SETUP.md](../SETUP.md) for certificate generation.

**Environment Variables:** See [SETUP.md](../SETUP.md) for complete list. Required: `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `STRIPE_SECRET_KEY`, `TWELVE_DATA_API_KEY`

---

## CORS Configuration

Allowed origins:
- `*.pages.dev` (Cloudflare Pages with wildcard matching)
- `http://localhost:5173` (Vite dev server)

Applied to all endpoints with `CORSMiddleware` wrapper.
