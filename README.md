# Brokerage Platform

Real-time cryptocurrency and forex trading platform with live charts, order books, news, and analytics.

---
## Cloudflare Deployment
Deployed at: [https://brokerageproject.pages.dev/](https://brokerageproject.pages.dev/)

---

## Commands

**Backend (Go)**
```bash
go mod tidy           # Install dependencies
cd cmd/server
go build ./cmd/server # Build binary
go run main.go        # Run server
go test ./...         # Run tests
```

**Frontend (React)**
```bash
cd frontend
pnpm install          # Install dependencies
pnpm run dev          # Start dev server
pnpm run typecheck    # Type checking
```

---

## Architecture

```
Frontend (React) <--WebSocket/REST--> Backend (Go) <--> Binance WS + API
                                                    <--> Alpha Vantage API
                                                    <--> RSS Feeds
```

---

## Structure

```
cmd/server/main.go                  # Server entry point
internal/
  ├── api/handlers.go               # HTTP/WebSocket handlers + tests
  ├── binance/client.go             # Binance WebSocket (trades + depth)
  ├── config/config.go              # Configuration
  ├── hub/hub.go                    # WebSocket broadcasting
  ├── services/                     # Alpha Vantage service
  ├── models/models.go              # Data models
  └── utils/                        # Utilities
frontend/src/
  ├── components/
  │   ├── ChartComponent.tsx        # Candlestick chart with OHLC/Volume
  │   ├── OrderBookPanel.tsx        # Order book + recent trades
  │   ├── TradingPanel.tsx          # Trading interface
  │   ├── InstrumentsPanel.tsx      # Instruments list
  │   ├── NewsPanel.tsx             # Multi-source news feed
  │   ├── AnalyticsPanel.tsx        # Alpha Vantage analytics
  │   ├── LeftToolbar.tsx           # Tool selector
  │   ├── LivePriceDisplay.tsx      # Live price ticker
  │   └── Header.tsx                # Theme toggle
  ├── context/WebSocketContext.tsx  # WebSocket provider
  └── App.tsx                       # Main component
```

---

## Tech Stack

**Backend:** Go 1.25.3, gorilla/websocket, go-cache  
**Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS, lightweight-charts  
**APIs:** Binance (WebSocket + REST), Alpha Vantage, RSS Feeds (6 sources)

### External APIs
- **Binance WebSocket**: Live trade data streaming
- **Binance REST API**: Historical klines and 24h ticker data
- **Alpha Vantage API**: Market analytics and forex data (EUR/USD real-time quotes)
- **RSS Feeds**: 
  - Crypto: CoinDesk, CryptoNews, CoinTelegraph
  - Forex: FXStreet, Investing.com, Yahoo Finance

---

## Features

### Real-Time Trading
- Live price updates via WebSocket
- Candlestick charts with OHLC/Volume display
- Order book with 10 levels (bids/asks)
- Recent trades history (last 50 trades)
- Multi-instrument support (BTCUSDT, ETHUSDT, SOLUSDT, EURUSDT)
- Auto-reconnect with exponential backoff

### Market Data
- Historical klines (multiple timeframes: 1h, 4h, 1d, custom)
- 24h ticker statistics (Binance + Alpha Vantage for forex)
- Real-time order book depth updates
- Color-coded price changes

### Analytics & News
- Alpha Vantage integration: Global Quote, RSI, SMA, EMA, MACD, Stochastic
- Multi-source news feed (6 RSS sources: crypto + forex)
- Search and filter (All, Crypto, Forex, Market, Alerts)
- Unread indicators and expandable articles

### UI/UX
- Dark/light theme with persistence
- Left toolbar for tool selection
- Responsive panels
- Real-time updates without page refresh

### Backend
- In-memory caching (klines: 5min, ticker: 10-60sec, news: 2min)
- Concurrent RSS fetching
- Hub-based WebSocket broadcasting
- Test coverage for handlers

---

## API Endpoints

**WebSocket:** `/ws` - Real-time price and order book updates  
**REST:** `/api/v1/klines` - Historical candlestick data  
**REST:** `/api/v1/ticker` - 24h ticker statistics  
**REST:** `/api/v1/news` - Aggregated news from 6 RSS sources  

---

## Environment Variables

Create `.env` file at project root (see `env.example`):
```
ALPHA_VANTAGE_API_KEY=your_api_key_here
```
