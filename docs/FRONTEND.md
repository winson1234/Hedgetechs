# Frontend Documentation

## Overview

React-based SPA providing real-time trading interface with live price updates, interactive charts, order books, news aggregation, and analytics.

**Tech:** React 18, TypeScript 5, Vite 5, Tailwind CSS, lightweight-charts

---

## Key Components

### App.tsx
**Purpose:** Main container and layout manager

**State:**
- `isDarkMode` - Theme (persisted to localStorage)
- `activeTimeframe` - Chart timeframe (1h, 4h, 1d, custom)
- `activeInstrument` - Selected instrument (BTCUSDT, ETHUSDT, SOLUSDT, EURUSDT)
- `showAnalyticsPanel` - Analytics panel visibility
- `activeTool` - Selected toolbar tool

**Features:**
- Dark/light mode with system preference detection
- Left toolbar for tool selection
- Responsive grid layout

---

### ChartComponent.tsx
**Purpose:** Candlestick chart with OHLC/Volume display

**Props:** `activeTimeframe`, `activeInstrument`

**State:** `chartData`, `loading`, `error`, `ohlcv`, `volumeDataRef`

**Features:**
- Lightweight-charts candlestick chart
- Fetches historical data from `/api/v1/klines`
- WebSocket integration for live candle updates
- OHLC and Volume display below chart (5-column grid)
- Real-time OHLCV updates synchronized with WebSocket
- Color-coded values (High: green, Low: red, Volume: blue)
- Formatted numbers with `toLocaleString()`
- Dark/light theme support

---

### OrderBookPanel.tsx
**Purpose:** Order book and recent trades display

**Props:** `activeInstrument`

**State:** `bids`, `asks`, `trades`, `activeTab`

**Features:**
- Two tabs: Order Book and Recent Trades
- Order book: 10 levels (bids/asks) from WebSocket depth stream
- Recent trades: Last 50 trades with color-coded buy/sell
- Real-time updates via WebSocket
- Price levels with quantities and totals

---

### TradingPanel.tsx
**Purpose:** Trading interface with live price, quick order entry and advanced order controls

**Props:** `activeInstrument`, `usdBalance`, `cryptoHoldings`, `onBuyOrder`, `onSellOrder`

**State / Behavior:** Holds price and order inputs; supports limit/market/stop-limit, TP/SL, recurring orders, fee display and pending orders.

**Features:**
- Live price updates via WebSocket
- Order types: Limit, Market, Stop-Limit
- TP/SL (Take Profit / Stop Loss) advanced options with trigger & limit offsets
- Fee displayed and applied to totals
- Pending orders list for limit and stop-limit orders
- Quick percentage buttons to calculate buy amounts from USD balance
- Trading mode tabs (spot, cross, isolated, grid)

---

### InstrumentsPanel.tsx
**Purpose:** List of tradable instruments with live ticker data

**Props:** `activeInstrument`, `setActiveInstrument`

**State:** `instruments`, `loading`, `error`

**Features:**
- Fetches 24h ticker data from `/api/v1/ticker`
- Auto-refresh every 10 seconds
- Displays symbol, price, 24h change
- Color-coded change indicators
- Click-to-select instrument
- Data source badges (Binance/Alpha Vantage)

---

### NewsPanel.tsx
**Purpose:** Multi-source news aggregation

**State:** `articles`, `filter`, `searchQuery`, `selectedArticle`, `readArticles`

**Features:**
- Fetches news from `/api/v1/news` (6 RSS sources)
- Search functionality
- Category filters (All, Crypto, Forex, Market, Alerts)
- Pagination (3 articles per page)
- Unread indicators (blue dots)
- Expandable modal for full article view
- Auto-refresh every 2 minutes
- Time-ago timestamps

---

### AnalyticsPanel.tsx
**Purpose:** Alpha Vantage analytics integration

**Props:** `isOpen`, `onClose`, `symbol`

**State:** `quoteData`, `rsiData`, `loading`, `error`

**Features:**
- Fetches data from `/api/v1/alphavantage`
- Global Quote: Real-time price, change, volume
- Technical Indicators: RSI, SMA, EMA, MACD, Stochastic
- Tabbed interface for different indicators
- Support for both crypto (BTC, ETH, SOL) and forex (EUR/USD)
- Dark/light theme support

---

### LeftToolbar.tsx
**Purpose:** Tool selector for additional features

**Props:** `activeTool`, `onToolSelect`

**Features:**
- Vertical toolbar on left side
- Alpha Vantage analytics button
- Highlights active tool

---

### Header.tsx
**Purpose:** Top navigation bar

**Props:** `isDarkMode`, `setIsDarkMode`

**Features:**
- Application title display
- Theme toggle button

---

### WebSocketContext.tsx
**Purpose:** Global WebSocket context provider

**Provides:**
- `ws` - WebSocket connection
- `lastMessage` - Last received message
- `isConnected` - Connection state

**Features:**
- Connects to `/ws` on mount
- Parses incoming JSON messages
- Auto-reconnect on disconnect
- Broadcasts messages to all consuming components

---

## Data Flow

### WebSocket
```
Binance → Backend Hub → /ws → WebSocketContext → Components
```

**Components using WebSocket:**
- ChartComponent (live candle updates)
- TradingPanel (live price)
- OrderBookPanel (depth updates + trades)
- LivePriceDisplay (price ticker)

### REST API
```
Component → API Request → Backend Handler → Cache/External API → Response → State Update
```

**Auto-refresh intervals:**
- InstrumentsPanel: Every 10 seconds
- NewsPanel: Every 2 minutes

---

## Styling

- **Framework:** Tailwind CSS with dark mode support
- **Theme:** Class-based dark mode with localStorage persistence
- **Colors:** Financial color scheme (red/green for gains/losses)
- **Layout:** Responsive grid with fixed-height panels

---

## Development

```bash
cd frontend
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run typecheck    # Type checking
pnpm run lint         # Linting
pnpm run build        # Production build
```

---

## Vite Configuration

Proxy configuration for development:
```typescript
{
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
}
```
