# Frontend Documentation

## Overview

The frontend is a React-based single-page application built with TypeScript and Vite. It provides a real-time trading interface with live price updates, interactive charts, market data display, and multi-source news aggregation.

---

## Technology Stack

- **React 18.2.0**: UI framework
- **TypeScript 5.9.3**: Type-safe JavaScript
- **Vite 5.0.0**: Build tool and dev server
- **Tailwind CSS 3.0.0**: Utility-first CSS framework
- **lightweight-charts 4.0.0**: Financial charting library
- **ESLint 8.48.0**: Code linting with TypeScript support

---

## Component Architecture

### App.tsx
**Purpose**: Main application container and layout manager

**State Management**:
- `isDarkMode`: Theme state (persisted to localStorage)
- `activeTimeframe`: Selected chart timeframe (1h, 4h, 1d, custom)
- `activeInstrument`: Currently selected trading instrument
- `showCustomInterval`: Custom interval modal visibility
- `customInterval`: User input for custom timeframe

**Key Features**:
- Dark/light mode with system preference detection
- Theme persistence using localStorage
- Fixed-height layout system (Trade: 190px, Instruments: 290px, News: 470px)
- Responsive grid layout with Tailwind CSS

---

### Header.tsx
**Purpose**: Top navigation bar with branding and theme toggle

**Props**:
- `isDarkMode`: Current theme state
- `setIsDarkMode`: Theme toggle function

**Features**:
- Application title display
- Theme toggle button with smooth transitions
- Dark/light mode styling variants

---

### ChartComponent.tsx
**Purpose**: Interactive candlestick chart with real-time updates

**Props**:
- `activeTimeframe`: Selected timeframe for data display
- `activeInstrument`: Symbol to display (e.g., BTCUSDT)

**State Management**:
- `chartData`: Historical kline data
- `loading`: Data fetch state
- `error`: Error state

**Key Features**:
- Candlestick chart using lightweight-charts library
- Fetches historical data from `/api/v1/klines`
- WebSocket integration for live candle updates
- Automatic chart updates on timeframe/instrument changes
- Responsive chart resizing
- Dark/light theme support

**Data Flow**:
1. Fetch historical klines on mount and when timeframe/instrument changes
2. Initialize chart with candlestick series
3. Subscribe to WebSocket for live price updates
4. Append new candles to chart in real-time

---

### TradePanel.tsx
**Purpose**: Trading interface with live price display and timeframe controls

**Props**:
- `activeTimeframe`: Current timeframe
- `setActiveTimeframe`: Timeframe change handler
- `showCustomInterval`: Custom interval modal state
- `setShowCustomInterval`: Modal toggle function
- `customInterval`: Custom interval input value
- `setCustomInterval`: Input change handler
- `handleCustomIntervalSubmit`: Submit custom interval
- `activeInstrument`: Current instrument

**State Management**:
- `price`: Live price from WebSocket
- `change24h`: 24-hour price change percentage
- `isDarkMode`: Theme state

**Key Features**:
- Real-time price updates via WebSocket
- 24-hour change percentage with color coding
- Timeframe selection buttons (1h, 4h, 1d, Custom)
- Custom interval input modal
- Active timeframe highlighting
- Instrument name display

**WebSocket Integration**:
- Connects to backend WebSocket at `/ws`
- Filters messages by active instrument symbol
- Updates price display in real-time

---

### InstrumentsPanel.tsx
**Purpose**: List of tradable instruments with live ticker data

**Props**:
- `activeInstrument`: Currently selected instrument
- `setActiveInstrument`: Instrument selection handler

**State Management**:
- `instruments`: Array of instrument ticker data
- `loading`: Fetch state
- `error`: Error state

**Key Features**:
- Fetches 24h ticker data from `/api/v1/ticker`
- Auto-refresh every 10 seconds
- Displays symbol, price, and 24h change
- Color-coded change indicators (green/red)
- Click-to-select instrument functionality
- Active instrument highlighting
- Scrollable container (fixed 290px height)

**Data Structure**:
```typescript
{
  symbol: string
  lastPrice: string
  priceChangePercent: string
}
```

---

### NewsPanel.tsx
**Purpose**: Multi-source news aggregation with search and filtering

**State Management**:
- `articles`: Array of news articles
- `loading`: Fetch state
- `error`: Error state
- `filter`: Active filter (all, crypto, forex, market, system)
- `searchQuery`: Search input value
- `selectedArticle`: Article for modal display
- `readArticles`: Set of read article GUIDs
- `lastFetchTime`: Timestamp of last fetch
- `currentPage`: Current pagination page
- `previousArticlesRef`: useRef to track previous articles

**Key Features**:
- Fetches news from `/api/v1/news` (6 RSS sources)
- Search functionality across title and description
- Category filters (All, Crypto, Forex, Market, Alerts)
- Pagination (3 articles per page)
- Unread indicators (blue dots) for new articles
- Expandable modal for full article view
- Auto-refresh every 2 minutes
- Time-ago timestamp formatting
- Source badges with color coding

**Filter Logic**:
- **All**: Shows all articles from all 6 sources
- **Crypto**: CoinDesk, CryptoNews, CoinTelegraph
- **Forex**: FXStreet, Investing.com, Yahoo Finance
- **Market**: All 6 sources
- **Alerts**: All 6 sources

**Unread Tracking**:
- Uses `useRef` to track articles from previous fetch
- Marks previously seen articles as read
- New articles display blue dot indicator
- First load marks all as read after 2 seconds

**Data Structure**:
```typescript
{
  title: string
  link: string
  description: string
  pubDate: string
  source: string
  guid?: string
}
```

---

### LivePriceDisplay.tsx
**Purpose**: Compact live price display component

**Props**:
- `activeInstrument`: Current instrument symbol

**State Management**:
- `price`: Current live price
- `prevPrice`: Previous price for comparison
- `priceDirection`: Direction indicator (up/down/neutral)

**Key Features**:
- WebSocket connection for live updates
- Price change animation
- Color-coded direction indicators
- Decimal precision formatting

---

## Hooks

### useWebSocket.tsx
**Purpose**: Custom hook for WebSocket connection management

**Parameters**:
- `url`: WebSocket endpoint URL
- `onMessage`: Message handler callback
- `options`: Connection options

**Features**:
- Automatic connection/reconnection
- Message event handling
- Connection state management
- Cleanup on unmount

---

## Context

### WebSocketContext.tsx
**Purpose**: Global WebSocket context provider

**Provides**:
- Shared WebSocket connection
- Connection state
- Message broadcasting to consumers

**Usage**:
```typescript
const { ws, isConnected } = useContext(WebSocketContext)
```

---

## Styling

### Tailwind Configuration
- Dark mode: Class-based strategy
- Custom colors for financial data (red/green)
- Responsive breakpoints
- Custom utilities for trading UI

### Theme System
- Dark mode default with light mode option
- System preference detection
- localStorage persistence
- Consistent color scheme across components

### Layout System
- Fixed heights for balanced appearance:
  - Trade Panel: 190px
  - Instruments Panel: 290px (scrollable)
  - News Panel: 470px
- Grid-based layout with proper spacing
- Overflow handling for scrollable content

---

## Data Flow

### WebSocket Data Flow
```
Binance Stream → Backend Hub → Frontend WebSocket → Component State → UI Update
```

### REST API Data Flow
```
Component Mount → API Request → Backend Handler → Cache Check → External API → Response → State Update → UI Render
```

### Auto-Refresh Pattern
```
Component Mount → Initial Fetch → Set Interval → Periodic Fetch → State Update → UI Update
```

---

## Error Handling

### API Errors
- Try-catch blocks around fetch operations
- Error state management in components
- User-friendly error messages
- Fallback UI for failed requests

### WebSocket Errors
- Connection retry logic
- Error state indicators
- Graceful degradation when connection fails

---

## Performance Optimizations

### Rendering
- React.memo for expensive components
- useCallback for event handlers
- useMemo for computed values
- Conditional rendering for modals

### Data Management
- Local state for component-specific data
- Minimal prop drilling
- Efficient re-render patterns

### Network
- Auto-refresh intervals aligned with backend cache durations
- WebSocket for real-time data (efficient)
- REST for historical/bulk data
- Client-side filtering and search (reduces server requests)

---

## Build Configuration

### Vite Config (vite.config.ts)
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

### TypeScript Config (tsconfig.json)
- Strict mode enabled
- ES2020 target
- JSX: React
- Module resolution: Node

### PostCSS Config (postcss.config.cjs)
- Tailwind CSS processing
- Autoprefixer for browser compatibility

---

## Development Workflow

### Local Development
1. Start backend server: `go run main.go` (in cmd/server)
2. Start frontend dev server: `pnpm run dev` (in frontend)
3. Access at `http://localhost:5173`

### Code Quality
- ESLint with TypeScript rules
- Max warnings: 0 (strict linting)
- React hooks linting enabled
- Type checking with `pnpm run typecheck`

### Testing
- Component testing with manual verification
- WebSocket connection testing
- API integration testing
- Cross-browser compatibility checks
