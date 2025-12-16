# Brokerage Platform
Comprehensive CFD and forex trading platform with cryptocurrency support, featuring authentication, real-time market data from multiple sources (Binance WebSocket + MT5), multi-account management with margin trading, wallet operations with Stripe payments, database-backed order processing, and technical analysis.

---

## Live Deployment

**Frontend:** [https://127.0.0.1:3000](https://127.0.0.1:3000) (Frontend port)
**Backend:** [https://127.0.0.1:8080](https://127.0.0.1:8080) (Backend port)

---

## Commands

### 🚀 Quick Start (Docker - Recommended)

```bash
# Start development environment
make dev                    # Start all services (frontend, backend, DB, redis)
make dev-daemon             # Start in background
make dev-logs               # View logs

# Stop services
make dev-down               # Stop all services
make dev-clean              # Stop and remove volumes
```

### 🔧 Manual Commands

**Backend (Go)**
```bash
go mod tidy                     # Install dependencies
go build                        # Build binary
cd cmd/server; go run main.go   # Run server (stops when terminal closes)
go test ./...                   # Run tests
```

**Frontend (React)**
```bash
cd frontend
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run typecheck    # TypeScript type checking
pnpm run lint         # Lint codebase
pnpm run build        # Production build
```

### 🔥 Troubleshooting

**Can't create demo or live accounts?**
```bash
./fix_database_and_accounts.sh
```

See [QUICK_START.md](./QUICK_START.md) or [DATABASE_FIX_GUIDE.md](./DATABASE_FIX_GUIDE.md) for details.

---

## Architecture

```
Frontend (React + React Router + Redux Toolkit)
    ↓ WebSocket + REST (CORS-enabled)
Backend (Go + Hub Pattern)
    ↓
├─ PostgreSQL Database (Supabase)
│  ├─ Trading accounts & positions
│  ├─ Orders & pending orders
│  ├─ Contracts (CFD positions)
│  └─ Audit logs & reconciliation
│
├─ Redis (Message Broker)
│  ├─ Pub/Sub: Real-time forex prices
│  └─ Hash: Latest price cache
│
├─ Market Data (Hybrid Provider Pattern)
│  ├─ Binance WebSocket (crypto: BTC, ETH, SOL)
│  └─ Redis Pub/Sub (forex: 9 pairs from MT5)
│
├─ External APIs
│  ├─ Binance REST API (klines, ticker)
│  ├─ TwelveData API (forex market data)
│  ├─ Stripe API (payments)
│  └─ RSS Feeds (6 sources: crypto + forex news)
│
└─ MT5 Publisher (Docker Container)
   └─ Publishes real-time forex prices to Redis
```

---

## Structure

```
cmd/server/main.go                        # Server entry point
internal/
  ├── api/
  │   ├── handlers.go                     # Core HTTP/WebSocket handlers
  │   ├── analytics_handler.go            # Forex analytics endpoint
  │   ├── payment_handler.go              # Stripe payment processing
  │   └── middleware.go                   # CORS middleware
  ├── database/
  │   └── database.go                     # PostgreSQL connection (pgx pool)
  ├── market_data/
  │   ├── provider.go                     # Provider interface
  │   ├── binance/provider.go             # Binance WebSocket provider
  │   └── redis/provider.go               # Redis Pub/Sub provider (forex)
  ├── services/
  │   ├── market_data_service.go          # Hybrid market data service
  │   ├── margin_service.go               # Margin & leverage calculations
  │   ├── order_processor.go              # Event-driven order processing
  │   └── audit_logger.go                 # Database-backed audit logging
  ├── binance/client.go                   # Binance WebSocket streams
  ├── config/config.go                    # Configuration management
  ├── hub/hub.go                          # WebSocket hub broadcasting
  ├── indicators/calculator.go            # Technical indicators
  ├── models/                             # Data models
  └── utils/                              # Utilities
mt5-publisher/
  ├── windows-api-server.py               # Flask API (Windows + MT5)
  ├── linux-bridge-service.py             # Redis publisher (Docker)
  ├── Dockerfile.bridge                   # Docker image
  └── requirements-*.txt                  # Python dependencies
sql-scripts/                              # Database schema organization
  ├── migrations/                         # Version-controlled migrations (golang-migrate)
  ├── schema/                             # Modular schema (tables, types, sequences, extensions)
  ├── functions/                          # SQL functions
  ├── triggers/                           # Database triggers
  ├── seed/                               # Initial data (crypto/forex instruments)
  ├── indexes/                            # Performance indexes
  └── views/                              # Database views
frontend/src/
  ├── components/
  │   ├── ChartComponent.tsx              # Advanced chart with drawings
  │   ├── TradingPanel.tsx                # Order execution with leverage
  │   ├── MarketActivityPanel.tsx         # Order book + pending orders
  │   ├── InstrumentsPanel.tsx            # Tradable assets (spot + CFD)
  │   ├── NewsPanel.tsx                   # Multi-source news
  │   ├── AnalyticsPanel.tsx              # Technical indicators
  │   ├── AccountPage.tsx                 # Trading account management
  │   ├── MainSidebar.tsx                 # Navigation sidebar
  │   ├── ProtectedRoute.tsx              # Route authentication guard
  │   ├── PublicRoute.tsx                 # Public route handler
  │   ├── AppLayout.tsx                   # Layout wrapper
  │   ├── wallet/                         # Deposit/Withdraw/Transfer
  │   └── market/                         # Trading history
  ├── pages/
  │   ├── DashboardPage.tsx               # Public landing page
  │   ├── LoginPage.tsx                   # User login (Supabase)
  │   ├── RegisterPage.tsx                # User registration (Supabase)
  │   ├── ForgotPasswordPage.tsx          # Password recovery
  │   ├── ProfilePage.tsx                 # User profile
  │   ├── SecuritySettingsPage.tsx        # Security settings
  │   ├── TradingPage.tsx                 # Trading interface
  │   ├── WalletPage.tsx                  # Wallet operations
  │   └── HistoryPage.tsx                 # Transaction history
  ├── store/
  │   ├── index.ts                        # Redux store configuration
  │   └── slices/                         # Redux Toolkit slices
  │       ├── authSlice.ts                # Authentication state
  │       ├── accountSlice.ts             # Multi-account + balances
  │       ├── orderSlice.ts               # Pending orders + history
  │       ├── priceSlice.ts               # Real-time prices
  │       ├── positionSlice.ts            # Open CFD positions
  │       ├── transactionSlice.ts         # Transaction history
  │       └── uiSlice.ts                  # UI state + navigation
  ├── context/WebSocketContext.tsx        # WebSocket manager
  ├── config/api.ts                       # API URL configuration
  └── App.tsx                             # React Router configuration
```

---

## Tech Stack

**Backend:** Go 1.23, gorilla/websocket, pgx (PostgreSQL), go-redis, go-cache, Stripe Go SDK, godotenv, golang-migrate
**Frontend:** React 18, TypeScript 5, Vite 5, React Router 6, Tailwind CSS, lightweight-charts, Redux Toolkit, Supabase.js, Stripe.js, Recharts
**Database:** PostgreSQL (Supabase) with Session Pooler
**Message Broker:** Redis 7 (Pub/Sub + Hash storage)
**Market Data:** Binance (WebSocket + REST), MT5 Publisher (Docker), TwelveData API, RSS Feeds
**Payments:** Stripe API
**Deployment:** Fly.io (backend), Cloudflare Pages (frontend), Docker (MT5 Publisher)

### External APIs
- **Binance WebSocket**: Real-time trade data and order book depth (crypto)
- **Binance REST API**: Historical klines (OHLCV) and 24h ticker statistics
- **MT5 Publisher**: Real-time forex prices (9 pairs) via Redis Pub/Sub
- **TwelveData API**: Forex market data and historical prices
- **Stripe API**: Payment intent creation and status verification
- **RSS Feeds (6 sources)**:
  - Crypto: CoinDesk, CryptoNews, CoinTelegraph
  - Forex: FXStreet, Investing.com, Yahoo Finance

---

## Features

### Authentication & User Management
- **Public Landing Page**: Market overview, news, FAQ section
- **User Registration**: Email-based signup with validation
- **User Login**: Session-based authentication with localStorage
- **Password Recovery**: Forgot password functionality
- **Profile Management**: Edit user information and settings
- **Security Settings**: Password change, 2FA toggle
- **Protected Routes**: Authentication-guarded trading pages

### Multi-Page Application
- **Trading Page**: Real-time charts, order execution, market data
- **Account Page**: Trading account management with portfolio visualization
- **Wallet Page**: Deposit (Stripe), withdraw, transfer operations
- **History Page**: Transaction history with filtering and analytics

### Real-Time Trading
- Live price updates via WebSocket for all instruments (crypto + forex)
- Advanced candlestick charts with 15 timeframes (1m to 1M)
- Order book with 20 levels (bids/asks) from Binance depth stream
- Drawing tools (horizontal/vertical lines) with persistence
- Product types: Spot trading and CFD (Contract for Difference)
- Order execution: Market, Limit, Stop-Limit
- Leverage support: 1x to 500x for CFD positions
- Dual-position hedging: Open both buy and sell positions simultaneously
- Margin calculations with real-time margin level monitoring
- Pending order auto-execution with database-backed processing
- Order history tracking per account
- Trading fee calculation (0.1%)
- A-Book/B-Book execution strategies

### Account Management
- Multiple account support (Live/Demo/External platforms)
- Multi-currency support (USD, EUR, MYR, JPY)
- Multi-asset balances (USD, BTC, ETH, SOL)
- Portfolio visualization with donut charts (Recharts)
- Real-time balance updates
- FX rate conversion from backend
- Account status tracking

### Wallet & Payments
- Stripe integration with Express Checkout (Google Pay, Apple Pay, Link)
- Card payments with Stripe Elements
- FPX Banking support (Malaysia)
- Automatic payment methods (enables all activated payment methods in Stripe dashboard)
- Real-time payment status tracking with polling
- Payment de-duplication
- Inter-account transfers
- Withdrawal processing
- Transaction history

### Market Data
- Hybrid market data architecture:
  - Binance WebSocket for crypto real-time prices
  - MT5 Publisher via Redis for forex real-time prices (9 pairs)
- Historical klines with 5-minute caching
- 24h ticker statistics (price, volume, high, low, change)
- Real-time order book depth updates (100ms interval)
- Real-time price ticker across all instruments
- Color-coded price movements
- Provider interface pattern for extensibility

### Analytics & News
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
- PostgreSQL database with pgx connection pool (25 max connections)
- Modular database organization (sql-scripts/) with golang-migrate
- Redis Pub/Sub for real-time forex data distribution
- Hybrid market data service with provider interface pattern
- Margin service for leverage and margin calculations
- Order processor for event-driven order execution
- Database-backed audit logging
- CORS middleware for Cloudflare Pages
- In-memory caching (klines: 5min, ticker: 10sec, news: 2min)
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
| `/api/v1/exchange-rate` | GET | Crypto-to-USD exchange rates (40+ cryptocurrencies) |
| `/api/v1/deposit/create-payment-intent` | POST | Stripe payment intent creation |
| `/api/v1/payment/status` | GET | Payment status verification |

---

## Setup

For environment variables, HTTPS configuration, and deployment instructions, see [SETUP.md](docs/SETUP.md).