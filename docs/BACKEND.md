# Backend Documentation

## Overview

Go-based HTTP and WebSocket server providing real-time market data streaming, historical data, ticker information, order book updates, multi-source news aggregation, forex analytics, and Stripe payment processing.

**Tech:** Go 1.25.3, gorilla/websocket, go-cache, net/http, Stripe API, Frankfurter API

---

## Architecture

```
Binance WS Streams → Hub → WebSocket Clients
                           ↓
HTTP Handlers → CORS Middleware → Cache → External APIs
                           ↓
                    Stripe/Frankfurter
```

---

## Core Components

### main.go
- Entry point
- Loads environment variables from `.env` (Stripe keys)
- Initializes Stripe with secret key
- Creates Hub and starts it in goroutine
- Starts Binance trade and depth streams
- Initializes Frankfurter forex service
- Registers HTTP/WebSocket handlers with CORS middleware
- HEAD request support for health checks
- Starts server on port from `PORT` env var (fallback: `8080`)

### hub/hub.go
**Purpose:** WebSocket client management and broadcasting

**Key Functions:**
- `NewHub()` - Creates hub with channels
- `Run()` - Handles client registration/unregistration and broadcasting
- `Broadcast(message)` - Sends message to all connected clients

### binance/client.go
**Purpose:** Binance WebSocket client

**Functions:**
- `StreamTrades(h *hub.Hub)` - Connects to Binance trade stream (BTCUSDT, ETHUSDT, SOLUSDT, EURUSDT)
- `StreamDepth(h *hub.Hub)` - Connects to Binance depth stream for order book updates
- Auto-reconnect with exponential backoff (1s → 60s max)

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
**Cache:** 60 seconds  
**Source:** Frankfurter API (free forex rates)  
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

### services/massive_service.go
**Frankfurter Forex Service:**
- Free forex rate API (no API key required)
- Currency conversion (EUR, GBP, JPY, MYR to USD)
- 5-minute caching
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
| `/ws` | WebSocket | Real-time price and order book updates |
| `/api/v1/klines` | GET | Historical candlestick data (OHLCV) |
| `/api/v1/ticker` | GET | 24h ticker statistics |
| `/api/v1/news` | GET | Aggregated news from 6 RSS sources |
| `/api/v1/analytics` | GET | Forex rates and technical indicators |
| `/api/v1/exchange-rate` | GET | Crypto-to-USD exchange rates (40+ cryptocurrencies) |
| `/api/v1/deposit/create-payment-intent` | POST | Stripe payment intent creation |
| `/api/v1/payment/status` | GET | Stripe payment status verification |

---

## Caching

| Data | Duration | Key Format |
|------|----------|------------|
| Klines | 5 min | `kline-{symbol}-{interval}-{limit}` |
| Ticker | 10 sec | `{symbol1},{symbol2},...` |
| News | 2 min | `all_news` |
| Analytics | 60 sec | Varies by request type |
| Forex Rates | 5 min | `fx_rate_{from}_{to}` |
| Crypto Exchange Rates | 30 sec | `exchange_rate_{symbol1}_{symbol2}_...` |

---

## Development

```bash
go mod tidy                     # Install dependencies
go build ./cmd/server           # Build binary
cd cmd/server; go run main.go   # Run server (auto-detects HTTPS certificates)
go test ./...                   # Run all tests
go test -v ./internal/api       # Test handlers with verbose output
go test -cover ./...            # Run with coverage report
```

**HTTPS Setup:** Server automatically detects `localhost+2.pem` and `localhost+2-key.pem` in project root and starts HTTPS server. See [../SETUP.md](SETUP.md) for certificate generation.

---

## CORS Configuration

Allowed origins:
- `*.pages.dev` (Cloudflare Pages with wildcard matching)
- `http://localhost:5173` (Vite dev server)

Applied to all endpoints with `CORSMiddleware` wrapper.
