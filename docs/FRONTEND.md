# Frontend Documentation

## Overview

React-based multi-page application providing comprehensive CFD and forex trading platform with cryptocurrency support, Supabase authentication, real-time price updates from multiple sources (Binance + MT5), interactive charts, multi-account management with margin trading, wallet operations with Stripe payments, database-backed transaction history, and analytics.

**Tech:** React 18, TypeScript 5, Vite 5, React Router, Tailwind CSS, lightweight-charts, Redux Toolkit, Supabase.js, Stripe

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

**State Management (Redux Toolkit slices):**
- `authSlice` - Authentication state, login/register/logout, user session
- `uiSlice` - Theme, navigation, active instrument, timeframe, toast notifications
- `priceSlice` - Real-time price data hydration from WebSocket (crypto + forex)
- `accountSlice` - Multi-account management, balances, currency conversion
- `orderSlice` - Pending orders fetched from database, order history
- `positionSlice` - Open CFD positions with margin tracking
- `transactionSlice` - Transaction history from database
- `forexSlice` - Forex-specific state and market data

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
**Purpose:** Comprehensive order execution interface with CFD and margin trading support

**Features:**
- Live price display with WebSocket updates (crypto + forex)
- Product type selection: Spot vs CFD
- Order types: Market, Limit, Stop-Limit
- Leverage selector for CFD positions (1x to 500x)
- Buy/Sell tabs with balance display
- Dual-position hedging support (open both buy and sell simultaneously)
- Quick percentage buttons (25%, 50%, 75%, 100%)
- Fee calculation (0.1% trading fee)
- Margin requirement calculation for CFD orders
- Real-time total calculation
- Account-specific balance tracking
- Order validation and execution
- Database-backed order submission
- Integration with Redux store for balance and position updates

---

### InstrumentsPanel.tsx
**Purpose:** Tradable instruments list with live market data for crypto and forex

**Features:**
- Displays crypto (BTCUSDT, ETHUSDT, SOLUSDT) and forex pairs (EURUSD, GBPUSD, etc.)
- Real-time price from priceSlice (WebSocket-powered, hybrid sources: Binance + MT5)
- 24h change percentage with color indicators
- High/Low 24h prices
- 24h volume display (crypto only)
- Product type indicators (Spot, CFD)
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
- Fetches from `/api/v1/analytics` (powered by TwelveData API)
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
**Purpose:** User authentication page with Supabase

**Features:**
- Email and password input with validation
- Supabase authentication integration
- "Remember me" checkbox
- Forgot password link
- Error message display from Supabase
- Redirect to dashboard after successful login
- Link to registration page
- Theme-aware styling

### RegisterPage.tsx
**Purpose:** New user registration page with Supabase

**Features:**
- Email, password, name, and country input fields
- Supabase user creation and metadata storage
- Password strength validation
- Terms and conditions checkbox
- Error message display from Supabase
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

### WalletPage.tsx / DepositTab.tsx
**Purpose:** Financial operations hub

**Tabs:**
- Deposit - Stripe Express Checkout and card payments with FPX banking support
- Withdraw - Account-to-account withdrawals
- Transfer - Inter-account transfers

**Deposit Features:**
- **Express Checkout Element** (Google Pay, Apple Pay, Link) - one-click payments
- Stripe Elements integration for card payments
- FPX Banking (Malaysia online banking)
- Automatic payment methods (enables all activated Stripe payment methods)
- Manual payment confirmation flow with `stripe.confirmPayment()`
- Real-time payment status tracking with polling (60s timeout)
- Payment intent de-duplication
- Account balance updates
- Currency conversion support
- Transaction history integration

**Payment Flow:**
1. User enters amount ≥ $5 → Express Checkout buttons appear
2. User clicks Google Pay/Apple Pay/Link or enters card details
3. `handleExpressCheckoutConfirm()` or `onSubmit()` called
4. `elements.submit()` validates payment details
5. Backend creates payment intent with automatic payment methods
6. Frontend calls `stripe.confirmPayment()` to complete payment
7. Polling checks payment status every 3s (max 60s)
8. On success: balance updated, transaction recorded

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
**Purpose:** Global WebSocket connection manager for hybrid market data

**Features:**
- Dynamic protocol detection (uses `wss://` for HTTPS, `ws://` for HTTP)
- Automatic environment-based connection (localhost dev, production URL)
- Price message broadcasting to priceSlice (crypto from Binance + forex from MT5/Redis)
- Deposit completion notifications from webhooks
- Order and position updates from database
- Redux dispatch for all state updates
- Auto-reconnect with exponential backoff (1s → 60s max) with jitter
- Connection state management
- Message parsing and distribution
- Real-time order matching on every price tick

---

## State Management

### Redux Toolkit Slices

**authSlice:**
- Supabase authentication state management
- Login/register/logout functionality via Supabase
- User session persistence
- User metadata (name, country, email)
- Auth status checking
- Protected route guards

**priceSlice:**
- Real-time price data for all instruments (crypto + forex)
- 24h statistics (high, low, open, volume, change)
- WebSocket-driven updates from hybrid sources (Binance + MT5/Redis)
- Initial hydration from REST API
- Price history for charting

**accountSlice:**
- Multi-account management (Live/Demo/External)
- Multi-currency balances (USD, EUR, MYR, JPY, BTC, ETH, SOL)
- Database-backed account data
- Deposit/withdraw/transfer operations
- FX rate fetching from backend
- Balance calculations with currency conversion
- Account status tracking
- Margin level monitoring

**orderSlice:**
- Pending orders fetched from PostgreSQL database
- Order history tracking
- Account-specific order filtering
- Database synchronization via API
- Real-time order updates via WebSocket

**positionSlice:**
- Open CFD positions from database
- Position management (open, close, modify)
- Leverage tracking
- Margin requirements calculation
- Profit/loss tracking
- Dual-position hedging support
- Real-time position updates

**transactionSlice:**
- Transaction history from database (Deposit/Withdraw/Transfer/Trade)
- Filtering and search functionality
- Summary statistics
- Database synchronization

**uiSlice:**
- Dark/light theme with localStorage persistence
- Page navigation state
- Active instrument and timeframe
- Analytics panel visibility
- Drawing tool selection
- Toast notifications
- Wallet tab state

**Store Configuration:**
- Redux Toolkit `configureStore` with Redux DevTools
- Immer for immutable state updates
- Thunks for async API calls
- Middleware for logging (development only)

---

## Data Flow

### WebSocket
```
Crypto: Binance → Backend → Hub → /ws → WebSocketContext → Redux dispatch (priceSlice) → Components
Forex: MT5 → Redis → Backend → Hub → /ws → WebSocketContext → Redux dispatch (priceSlice) → Components
```

**Real-time Updates:**
- ChartComponent - Live candle updates with timestamp validation
- TradingPanel - Current price display (crypto + forex)
- MarketActivityPanel - Order book depth (20 levels for crypto)
- LivePriceDisplay - Price ticker
- InstrumentsPanel - All instrument prices (hybrid sources)
- Order processor - Backend-driven pending order execution

### REST API
```
Component → getApiUrl() → API Request → Backend Handler → Database → Response → Redux dispatch
```

**API Configuration:**
- Development: Relative paths with Vite proxy
- Production: Direct to deployment URL
- CORS-enabled for Cloudflare Pages (`*.pages.dev`)

**Key Endpoints:**
- `/api/v1/ticker` - Initial price hydration
- `/api/v1/klines` - Historical chart data
- `/api/v1/news` - News articles
- `/api/v1/analytics` - Forex rates and indicators (TwelveData)
- `/api/v1/deposit/create-payment-intent` - Stripe payments
- `/api/v1/payment/status` - Payment verification
- `/api/v1/orders` - Pending orders from database
- `/api/v1/positions` - Open CFD positions
- `/api/v1/accounts` - Trading accounts

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
- **Elements:** CardNumberElement, CardExpiryElement, CardCvcElement, ExpressCheckoutElement
- **Payment Methods:**
  - Express Checkout (Google Pay, Apple Pay, Link)
  - Card (Visa, Mastercard, Amex)
  - FPX Banking (Malaysia online banking)
- **Automatic Payment Methods:** Backend uses `AutomaticPaymentMethods` when `payment_method_types` not specified
- **Flow:**
  1. Create payment intent (no payment_method_types → automatic methods enabled)
  2. Manual confirmation with `stripe.confirmPayment({ elements, clientSecret, redirect: 'if_required' })`
  3. Poll status every 3s for 60s
  4. Update balance on success
- **Security:** Client-side tokenization, server-side processing, HTTPS required for Express Checkout
- **De-duplication:** Prevents duplicate deposits on page refresh
- **Error Handling:** Structured error returns `{ error: { message } }` for Express Checkout compatibility

---

## Development

```bash
cd frontend
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (https://localhost:5173 with HTTPS, http without)
pnpm run typecheck    # TypeScript type checking
pnpm run lint         # ESLint
pnpm run build        # Production build for Cloudflare Pages
```

**HTTPS Setup:** See [../SETUP.md](SETUP.md) for local HTTPS configuration (required for Express Checkout)
