# Brokerage Platform

Comprehensive cryptocurrency trading platform with real-time market data, multi-account management, wallet operations with Stripe payments, transaction history, and technical analysis.

---

## Live Deployment

**Frontend:** [https://brokerageproject.pages.dev](https://brokerageproject.pages.dev) (Cloudflare Pages)  
**Backend:** [https://brokerageproject.onrender.com](https://brokerageproject.onrender.com) (Render)

---

## Commands

**Backend (Go)**
```bash
go mod tidy                    # Install dependencies
go build -o server ./cmd/server # Build binary
cd cmd/server && go run main.go # Run server
go test ./...                   # Run tests
```

**Frontend (React)**
```bash
cd frontend
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run typecheck    # TypeScript type checking
pnpm run build        # Production build
```

---

## Architecture

```
Frontend (React + Zustand)
    ↓ WebSocket + REST (CORS-enabled)
Backend (Go + Hub Pattern)
    ↓
├─ Binance WebSocket (trades + depth)
├─ Binance REST API (klines, ticker)
├─ Frankfurter API (forex rates)
├─ Stripe API (payments)
└─ RSS Feeds (6 sources: crypto + forex news)
```

---

## Structure

```
cmd/server/main.go                        # Server entry point with Stripe init
internal/
  ├── api/
  │   ├── handlers.go                     # Core HTTP/WebSocket handlers
  │   ├── analytics_handler.go            # Forex analytics endpoint
  │   ├── payment_handler.go              # Stripe payment processing
  │   └── middleware.go                   # CORS middleware
  ├── binance/client.go                   # Binance WebSocket streams
  ├── config/config.go                    # API URLs and paths
  ├── hub/hub.go                          # WebSocket hub broadcasting
  ├── services/massive_service.go         # Frankfurter forex service
  ├── indicators/calculator.go            # Technical indicators
  ├── models/                             # Data models
  └── utils/                              # Utilities
frontend/src/
  ├── components/
  │   ├── ChartComponent.tsx              # Advanced chart with drawings
  │   ├── TradingPanel.tsx                # Order execution
  │   ├── MarketActivityPanel.tsx         # Order book + pending orders
  │   ├── InstrumentsPanel.tsx            # Tradable assets
  │   ├── NewsPanel.tsx                   # Multi-source news
  │   ├── AnalyticsPanel.tsx              # Technical indicators
  │   ├── AccountPage.tsx                 # Multi-account management
  │   ├── MainSidebar.tsx                 # Navigation sidebar
  │   ├── wallet/                         # Deposit/Withdraw/Transfer
  │   └── market/                         # Trading history
  ├── pages/
  │   ├── WalletPage.tsx                  # Wallet operations
  │   └── HistoryPage.tsx                 # Transaction history
  ├── stores/                             # Zustand state management
  │   ├── accountStore.ts                 # Multi-account + balances
  │   ├── orderStore.ts                   # Pending orders + history
  │   ├── priceStore.ts                   # Real-time prices
  │   ├── transactionStore.ts             # Transaction history
  │   └── uiStore.ts                      # UI state + navigation
  ├── context/WebSocketContext.tsx        # WebSocket manager
  ├── config/api.ts                       # API URL configuration
  └── App.tsx                             # Multi-page layout
```

---

## Tech Stack

**Backend:** Go 1.25.3, gorilla/websocket, go-cache, Stripe Go SDK  
**Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS, lightweight-charts, Zustand, Stripe.js, Recharts  
**APIs:** Binance (WebSocket + REST), Frankfurter (forex), Stripe (payments), RSS Feeds

### External APIs
- **Binance WebSocket**: Real-time trade data and order book depth (4 symbols)
- **Binance REST API**: Historical klines (OHLCV) and 24h ticker statistics
- **Frankfurter API**: Free forex conversion rates (no API key required)
- **Stripe API**: Payment intent creation and status verification
- **RSS Feeds (6 sources)**: 
  - Crypto: CoinDesk, CryptoNews, CoinTelegraph
  - Forex: FXStreet, Investing.com, Yahoo Finance

---

## Features

### Multi-Page Application
- **Trading Page**: Real-time charts, order execution, market data
- **Account Page**: Multi-account management with portfolio visualization
- **Wallet Page**: Deposit (Stripe), withdraw, transfer operations
- **History Page**: Transaction history with filtering and analytics

### Real-Time Trading
- Live price updates via WebSocket for all instruments
- Advanced candlestick charts with 15 timeframes (1m to 1M)
- Order book with 20 levels (bids/asks) from Binance depth stream
- Drawing tools (horizontal/vertical lines) with persistence
- Order execution: Market, Limit, Stop-Limit
- Pending order auto-execution with WebSocket price matching
- Order history tracking per account
- Trading fee calculation (0.1%)

### Account Management
- Multiple account support (Live/Demo/External platforms)
- Multi-currency support (USD, EUR, MYR, JPY)
- Multi-asset balances (USD, BTC, ETH, SOL)
- Portfolio visualization with donut charts (Recharts)
- Real-time balance updates
- FX rate conversion from backend
- Account status tracking

### Wallet & Payments
- Stripe integration for card payments
- FPX Banking support (Malaysia)
- Real-time payment status tracking
- Payment de-duplication
- Inter-account transfers
- Withdrawal processing
- Transaction history

### Market Data
- Historical klines with 5-minute caching
- 24h ticker statistics (price, volume, high, low, change)
- Real-time order book depth updates (100ms interval)
- Real-time price ticker across all instruments
- Color-coded price movements

### Analytics & News
- Forex rate conversion (Frankfurter API)
- Technical indicators: RSI, SMA, EMA, MACD
- Multi-source news aggregation (6 RSS feeds)
- Search and category filtering
- Unread tracking with localStorage
- Expandable article modal

### UI/UX
- Dark/light theme with localStorage persistence
- Multi-page navigation with state persistence
- Toast notification system
- Responsive design (mobile-first)
- Drawing tools with symbol-specific storage
- Real-time updates without page refresh

### Backend
- CORS middleware for Cloudflare Pages
- In-memory caching (klines: 5min, ticker: 10sec, news: 2min, forex: 5min)
- Concurrent RSS fetching
- Hub-based WebSocket broadcasting
- Auto-reconnect with exponential backoff
- HEAD request support for health monitoring
- Stripe webhook-ready architecture

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ws` | WebSocket | Real-time price and order book streaming |
| `/api/v1/klines` | GET | Historical candlestick data (OHLCV) |
| `/api/v1/ticker` | GET | 24h ticker statistics |
| `/api/v1/news` | GET | Multi-source news aggregation |
| `/api/v1/analytics` | GET | Forex rates and technical indicators |
| `/api/v1/deposit/create-payment-intent` | POST | Stripe payment intent creation |
| `/api/v1/payment/status` | GET | Payment status verification |

---

## Environment Variables

Create `.env` file at project root (see `env.example`):

**Backend:**
```
STRIPE_SECRET_KEY=sk_test_...
```

**Frontend (.env.local):**
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```
