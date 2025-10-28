# Backend Documentation

## Overview

Go-based HTTP and WebSocket server providing real-time market data streaming, historical data, ticker information, order book updates, and multi-source news aggregation.

**Tech:** Go 1.25.3, gorilla/websocket, go-cache, net/http

---

## Architecture

```
main.go → Hub → Binance WebSocket Streams (trades + depth) → HTTP Handlers → Clients
```

---

## Core Components

### main.go
- Entry point
- Initializes Hub and starts it in goroutine
- Starts Binance trade and depth streams
- Registers HTTP/WebSocket handlers
- Starts server on `:8080`

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
- Upgrades HTTP to WebSocket
- Creates client with send channel
- Registers client with hub
- Starts read/write goroutines

#### HandleKlines(w, r)
**Query:** `symbol`, `interval`, `limit`  
**Cache:** 5 minutes  
**Returns:** Historical candlestick data from Binance

#### HandleTicker(w, r)
**Query:** `symbols` (comma-separated)  
**Cache:** 10 seconds (Binance), 60 seconds (Alpha Vantage)  
**Logic:** 
- EURUSDT → Alpha Vantage CURRENCY_EXCHANGE_RATE
- Others → Binance 24h ticker
**Returns:** 24h ticker statistics

#### HandleNews(w, r)
**Cache:** 2 minutes  
**Logic:** Fetches 6 RSS feeds concurrently, parses XML, combines and sorts by time  
**Sources:** CoinDesk, CryptoNews, CoinTelegraph, FXStreet, Investing.com, Yahoo Finance  
**Returns:** Aggregated news articles

#### HandleAlphaVantage(w, r)
**Query:** `function`, `symbol`, `interval`, etc.  
**Cache:** 60 seconds  
**Purpose:** Proxy to Alpha Vantage API for analytics (RSI, SMA, EMA, MACD, Stochastic)

### config/config.go
**Constants:**
- Binance WebSocket URLs (trade + depth streams)
- Binance REST URLs (klines, ticker)
- Alpha Vantage base URL
- RSS feed URLs (6 sources)
- Local server paths

### services/
**AlphaVantageService:** Handles Alpha Vantage API integration

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ws` | WebSocket | Real-time price and order book updates |
| `/api/v1/klines` | GET | Historical candlestick data |
| `/api/v1/ticker` | GET | 24h ticker statistics |
| `/api/v1/news` | GET | Aggregated news from 6 RSS sources |
| `/api/v1/alphavantage` | GET | Alpha Vantage analytics proxy |

---

## Caching

| Data | Duration | Key Format |
|------|----------|------------|
| Klines | 5 min | `kline-{symbol}-{interval}-{limit}` |
| Ticker (Binance) | 10 sec | `{symbol1},{symbol2},...` |
| Ticker (Alpha Vantage) | 60 sec | `av_ticker_{symbol}` |
| News | 2 min | `all_news` |
| Alpha Vantage | 60 sec | `av_{function}_{params}` |

---

## Testing

```bash
go test ./...                                  # Run all tests
go test -v ./internal/api -run TestHandleTicker # Test specific handler
go test -cover ./...                           # Run with coverage
```

---

## Environment Variables

Required for Alpha Vantage integration:
```
ALPHA_VANTAGE_API_KEY=your_api_key_here
```

Place in `.env` file at project root.
