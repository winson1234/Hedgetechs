# Frontend Documentation

## Overview

React-based multi-page application providing comprehensive trading platform with authentication, real-time price updates, interactive charts, multi-account management, wallet operations with Stripe payments, transaction history, and analytics.

**Tech:** React 18, TypeScript 5, Vite 5, React Router, Tailwind CSS, lightweight-charts, Zustand, Stripe

---

## Key Components

### App.tsx
**Purpose:** React Router configuration and route management

**Route Structure:**
- **Public Routes** (redirect to dashboard if logged in)
  - `/login` - User login page
  - `/register` - New user registration
  - `/forgot-password` - Password recovery
- **Protected Routes** (require authentication)
  - `/trading` - Main trading interface with charts and order execution
  - `/account` - Multi-account management with portfolio visualization
  - `/wallet` - Deposit/withdraw/transfer with Stripe integration
  - `/history` - Transaction history and analytics
  - `/profile` - User profile management
  - `/settings/security` - Security settings (password change)
- **Public Pages**
  - `/` and `/dashboard` - Public landing page with market overview

**State Management (Zustand stores):**
- `authStore` - Authentication state, login/register/logout with localStorage
- `uiStore` - Theme, navigation, active instrument, timeframe, toast notifications
- `priceStore` - Real-time price data hydration from WebSocket
- `accountStore` - Multi-account management, balances, currency conversion
- `orderStore` - Pending orders, order history, auto-execution logic
- `transactionStore` - Transaction history tracking

**Features:**
- React Router with protected and public routes
- Authentication persistence with localStorage
- Dark/light mode with localStorage persistence
- Responsive layout with conditional sidebars
- Toast notification system

---

### ChartComponent.tsx
**Purpose:** Advanced candlestick chart with technical analysis

**Features:**
- Lightweight-charts candlestick chart with custom timeframes
- Fetches historical data from `/api/v1/klines` (200 candles)
- WebSocket integration for real-time candle updates
- Multiple timeframes: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
- OHLCV display with live updates
- Drawing tools support (horizontal/vertical lines)
- Drawing persistence per symbol (localStorage)
- Real-time price line with color indicators
- Timestamp validation to prevent "oldest data" errors
- Symbol-specific message filtering
- Dark/light theme support

---

### MarketActivityPanel.tsx
**Purpose:** Combined order book and trade history display

**Tabs:**
- Order Book - Live bid/ask levels from Binance depth stream
- Pending Orders - User's limit and stop-limit orders
- Trade History - Executed orders for active account

**Features:**
- Real-time order book updates (20 levels each side)
- Pending order management (cancel functionality)
- Account-specific order filtering
- Color-coded price changes
- Formatted prices and quantities

---

### TradingPanel.tsx
**Purpose:** Comprehensive order execution interface

**Features:**
- Live price display with WebSocket updates
- Order types: Market, Limit, Stop-Limit
- Buy/Sell tabs with balance display
- Quick percentage buttons (25%, 50%, 75%, 100%)
- Fee calculation (0.1% trading fee)
- Real-time total calculation
- Account-specific balance tracking
- Order validation and execution
- Integration with accountStore for balance updates
- Integration with orderStore for pending orders

---

### InstrumentsPanel.tsx
**Purpose:** Tradable instruments list with live market data

**Features:**
- Displays BTCUSDT, ETHUSDT, SOLUSDT, EURUSDT
- Real-time price from priceStore (WebSocket-powered)
- 24h change percentage with color indicators
- High/Low 24h prices
- 24h volume display
- Click to switch active instrument
- Active instrument highlighting
- Auto-updates without API polling

---

### NewsPanel.tsx
**Purpose:** Multi-source financial news aggregation

**Features:**
- Fetches from `/api/v1/news` (CoinDesk, CryptoNews, CoinTelegraph, FXStreet, Investing.com, Yahoo Finance)
- Search functionality across titles and descriptions
- Category filters: All, Crypto, Forex, Market
- Pagination (5 articles per page)
- Unread indicators with localStorage tracking
- Expandable modal for full articles
- External links to original sources
- Relative time display (e.g., "2 hours ago")
- Manual refresh button

---

### AnalyticsPanel.tsx
**Purpose:** Technical indicators and forex rates panel

**Tabs:**
- Forex - Real-time forex conversion rates (EUR/USD, GBP/USD, JPY/USD, etc.)
- RSI - Relative Strength Index
- SMA - Simple Moving Average
- EMA - Exponential Moving Average
- MACD - Moving Average Convergence Divergence

**Features:**
- Fetches from `/api/v1/analytics` (powered by Frankfurter API)
- Symbol and period selection
- Real-time rate calculations
- Slide-out panel with close functionality
- Instrument-aware analytics
- Dark/light theme support

---

### DashboardPage.tsx
**Purpose:** Public landing page with market overview and information

**Features:**
- Cryptocurrency market data display (BTC, ETH, SOL, etc.)
- Market tabs: Popular, Gainers, Losers
- News section with category filters
- FAQ accordion section
- Responsive hero section with call-to-action
- Theme toggle (dark/light)
- Language selector
- Logout confirmation modal
- Navigation to login/register or trading pages

### LoginPage.tsx
**Purpose:** User authentication page

**Features:**
- Email and password input with validation
- "Remember me" checkbox
- Forgot password link
- Error message display
- Redirect to dashboard after successful login
- Link to registration page
- Theme-aware styling

### RegisterPage.tsx
**Purpose:** New user registration page

**Features:**
- Email, password, name, and country input fields
- Password strength validation
- Terms and conditions checkbox
- Error message display
- Redirect to trading page after registration
- Link to login page
- Theme-aware styling

### ForgotPasswordPage.tsx
**Purpose:** Password recovery page

**Features:**
- Email input for password reset
- Validation and error handling
- Success message display
- Link back to login page

### ProfilePage.tsx
**Purpose:** User profile management

**Features:**
- Display user information (name, email, country)
- Edit profile fields
- Profile picture upload
- Save changes functionality
- Navigation back to trading

### SecuritySettingsPage.tsx
**Purpose:** Account security management

**Features:**
- Current password verification
- New password input with confirmation
- Password strength indicator
- Two-factor authentication toggle
- Session management
- Change password functionality

### AccountPage.tsx
**Purpose:** Trading account management and portfolio visualization

**Features:**
- Account switcher with Live/Demo/External accounts
- Total portfolio value across all accounts
- Account creation modal (Live/Demo)
- Currency selection (USD, EUR, MYR, JPY)
- Platform type selection (Integrated/External)
- Portfolio allocation chart (Recharts donut chart)
- Account holdings breakdown
- Balance editing modal
- FX rate conversion for multi-currency accounts

### WalletPage.tsx
**Purpose:** Financial operations hub

**Tabs:**
- Deposit - Stripe card payments with FPX banking support
- Withdraw - Account-to-account withdrawals
- Transfer - Inter-account transfers

**Features:**
- Stripe Elements integration for card payments
- Real-time payment status tracking
- Payment intent de-duplication
- Account balance updates
- Currency conversion support
- Transaction history integration

### HistoryPage.tsx
**Purpose:** Transaction history and analytics

**Features:**
- Transaction list with filtering (All/Deposit/Withdraw/Transfer/Trade)
- Date range filtering
- Summary cards (total deposits, withdrawals, trades)
- Transaction detail modal
- CSV export functionality
- Account-specific filtering

### MainSidebar.tsx
**Purpose:** Navigation sidebar for non-trading pages

**Features:**
- Page navigation (Trading, Account, Wallet, History)
- Active page highlighting
- Profile dropdown with account info
- Theme toggle
- Fixed positioning

### LeftToolbar.tsx
**Purpose:** Trading page tool selector

**Features:**
- Analytics panel toggle
- Drawing tools selector (horizontal/vertical lines)
- Active tool highlighting
- Icon-based vertical toolbar

### Header.tsx
**Purpose:** Top navigation bar

**Features:**
- Application branding
- Live price ticker
- Theme toggle
- Profile dropdown (on non-trading pages)

---

### WebSocketContext.tsx
**Purpose:** Global WebSocket connection manager

**Features:**
- Connects to backend WebSocket (`ws://localhost:8080/ws` dev, `wss://brokerageproject.fly.dev/ws` prod)
- Price message broadcasting to priceStore
- Order execution triggering via orderStore
- Auto-reconnect with exponential backoff (1s → 60s max) with jitter
- Connection state management
- Message parsing and distribution
- Real-time order matching on every price tick

---

## State Management

### Zustand Stores

**authStore:**
- Authentication state management
- Login/register/logout functionality
- User data persistence with localStorage
- Session management
- Auth status checking

**priceStore:**
- Real-time price data for all instruments
- 24h statistics (high, low, open, volume, change)
- WebSocket-driven updates
- Initial hydration from REST API

**accountStore:**
- Multi-account management (Live/Demo/External)
- Multi-currency balances (USD, EUR, MYR, JPY, BTC, ETH, SOL)
- Deposit/withdraw/transfer operations
- FX rate fetching from backend
- Balance calculations with currency conversion
- Account status tracking

**orderStore:**
- Pending order management (limit, stop-limit)
- Order execution logic with price matching
- Order history tracking
- Account-specific order filtering
- Real-time order processing via WebSocket

**transactionStore:**
- Transaction history (Deposit/Withdraw/Transfer/Trade)
- Filtering and search functionality
- Summary statistics

**uiStore:**
- Dark/light theme with persistence
- Page navigation state
- Active instrument and timeframe
- Analytics panel visibility
- Drawing tool selection
- Toast notifications
- Wallet tab state

---

## Data Flow

### WebSocket
```
Binance → Backend Hub → /ws → WebSocketContext → priceStore/orderStore → Components
```

**Real-time Updates:**
- ChartComponent - Live candle updates with timestamp validation
- TradingPanel - Current price display
- MarketActivityPanel - Order book depth (20 levels)
- LivePriceDisplay - Price ticker
- InstrumentsPanel - All instrument prices
- orderStore - Automatic pending order execution

### REST API
```
Component → getApiUrl() → API Request → Backend Handler → Response → Store Update
```

**API Configuration:**
- Development: Relative paths with Vite proxy
- Production: Direct to `https://brokerageproject.fly.dev`
- CORS-enabled for Cloudflare Pages (`*.pages.dev`)

**Key Endpoints:**
- `/api/v1/ticker` - Initial price hydration
- `/api/v1/klines` - Historical chart data
- `/api/v1/news` - News articles
- `/api/v1/analytics` - Forex rates and indicators
- `/api/v1/deposit/create-payment-intent` - Stripe payments
- `/api/v1/payment/status` - Payment verification

---

## Styling

- **Framework:** Tailwind CSS with JIT mode
- **Theme:** Dark mode with `dark:` variants and localStorage persistence
- **Colors:** Financial UI (green for buy/up, red for sell/down)
- **Components:** Custom styled with Tailwind utilities
- **Stripe Elements:** Dynamic styling based on theme
- **Layout:** Responsive grid (mobile-first approach)

---

## Payment Integration

### Stripe Setup
- **Elements:** CardNumberElement, CardExpiryElement, CardCvcElement
- **Payment Methods:** Card, FPX Banking (Malaysia)
- **Flow:** Create payment intent → Confirm → Poll status → Update balance
- **Security:** Client-side tokenization, server-side processing
- **De-duplication:** Prevents duplicate deposits on page refresh

---

## Development

```bash
cd frontend
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run typecheck    # TypeScript type checking
pnpm run lint         # ESLint
pnpm run build        # Production build for Cloudflare Pages
```

## Deployment

**Platform:** Cloudflare Pages  
**Build Command:** `pnpm run build`  
**Output Directory:** `dist`  
**Live URL:** https://brokerageproject.pages.dev
