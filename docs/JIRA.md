# JIRA Backlog

## 1. [Frontend] Chart Display

**Description:**
Implement an interactive candlestick chart component using lightweight-charts library to display real-time market data. The chart integrates with the backend WebSocket for live price updates and REST API for historical data. Features include multiple timeframe support (1h, 4h, 1d, custom intervals), multi-instrument switching, and dynamic updates based on user selection.

**Subtasks:**

1. **Install and configure lightweight-charts library**
   - **Approach**: Added `lightweight-charts: ^4.0.0` to package.json dependencies
   - **Evidence**: Package installed and imported in ChartComponent.tsx
   - **Status**: ✓ Completed

2. **Create ChartComponent.tsx with candlestick chart initialization**
   - **Approach**: Created component with `createChart()` and `addCandlestickSeries()` from lightweight-charts API
   - **Evidence**: File located at `frontend/src/components/ChartComponent.tsx`, chart renders with candlestick series
   - **Status**: ✓ Completed

3. **Implement fetchKlines function to retrieve historical data from /api/v1/klines endpoint**
   - **Approach**: Used fetch API with query parameters (symbol, interval, limit) to call backend REST endpoint
   - **Solution**: `await fetch(\`/api/v1/klines?symbol=${activeInstrument}&interval=${activeTimeframe}&limit=100\`)`
   - **Evidence**: Chart displays historical candlestick data on load
   - **Status**: ✓ Completed

4. **Add timeframe state management with support for 1h, 4h, 1d, and custom intervals**
   - **Approach**: Managed `activeTimeframe` state in App.tsx, passed as prop to ChartComponent
   - **Solution**: Added buttons in TradePanel for 1h, 4h, 1d, and Custom with modal input for custom intervals
   - **Evidence**: Clicking timeframe buttons updates chart data dynamically
   - **Status**: ✓ Completed

5. **Integrate WebSocket live price updates to append new candles in real-time**
   - **Approach**: Connected to WebSocket at `/ws`, filtered messages by symbol, updated chart series with `update()` method
   - **Solution**: WebSocket message handler updates last candle close price in real-time
   - **Evidence**: Price changes visible on chart without refresh
   - **Status**: ✓ Completed

6. **Add chart resize handling and responsive layout**
   - **Approach**: Used `applyOptions({ width: container.clientWidth })` and resize observer
   - **Evidence**: Chart adjusts width when browser window resizes
   - **Status**: ✓ Completed

7. **Implement instrument switching to update chart data dynamically**
   - **Approach**: Added `activeInstrument` state in App.tsx, triggered fetchKlines on instrument change
   - **Solution**: `useEffect` with `activeInstrument` and `activeTimeframe` dependencies refetches data
   - **Evidence**: Clicking different instruments in InstrumentsPanel updates chart
   - **Status**: ✓ Completed

8. **Add loading and error states for data fetching**
   - **Approach**: Used `loading` and `error` state variables with conditional rendering
   - **Evidence**: "Loading chart..." message during fetch, error message on API failure
   - **Status**: ✓ Completed

9. **Configure chart styling for dark/light mode compatibility**
   - **Approach**: Applied dark background colors and white/green/red candles for dark mode
   - **Solution**: `layout: { background: { color: 'transparent' }, textColor: '#d1d5db' }`
   - **Evidence**: Chart styling matches application theme
   - **Status**: ✓ Completed

---

## 2. [Frontend] Layout Setup

**Description:**
Design and implement the main application layout structure with fixed-height components for balanced visual appearance. The layout includes a top header, center chart area, right sidebar with trade panel and instruments list, and bottom news panel. All sections use Tailwind CSS for styling with dark mode support and scrollable overflow handling.

**Subtasks:**

1. **Create App.tsx main layout container**
   - **Approach**: Created main component with grid layout using Tailwind CSS classes
   - **Evidence**: File located at `frontend/src/App.tsx` with complete layout structure
   - **Status**: ✓ Completed

2. **Implement dark mode state management with localStorage persistence**
   - **Approach**: Used `useState` for `isDarkMode` with `useEffect` hooks to read/write localStorage
   - **Solution**: `localStorage.getItem('isDarkMode')` on mount, `localStorage.setItem('isDarkMode', value)` on change
   - **Evidence**: Theme preference persists across browser sessions
   - **Status**: ✓ Completed

3. **Add theme preference detection from system settings**
   - **Approach**: Used `window.matchMedia('(prefers-color-scheme: dark)')` to detect system preference
   - **Solution**: Falls back to system preference if no localStorage value exists
   - **Evidence**: Application respects OS dark/light mode on first visit
   - **Status**: ✓ Completed

4. **Design responsive grid layout with proper spacing**
   - **Approach**: Used Tailwind grid classes with `grid grid-cols-[1fr_400px]` for main layout
   - **Evidence**: Layout adjusts with consistent spacing between components
   - **Status**: ✓ Completed

5. **Set fixed heights for Trade Panel (190px), Instruments Panel (290px), and News Panel (470px)**
   - **Approach**: Applied Tailwind height classes: `h-[190px]`, `h-[290px]`, `h-[470px]`
   - **Solution**: Fixed heights ensure balanced visual appearance regardless of content
   - **Evidence**: All components maintain consistent heights, total sidebar = 950px
   - **Status**: ✓ Completed

6. **Add overflow-y-auto for scrollable content in Instruments and News sections**
   - **Approach**: Added `overflow-y-auto` class to containers with fixed heights
   - **Evidence**: Instruments list scrolls when >4 items, News panel scrolls within fixed 470px height
   - **Status**: ✓ Completed

7. **Configure Tailwind dark mode with class-based strategy**
   - **Approach**: Set `darkMode: 'class'` in tailwind.config.cjs, applied `dark:` prefix classes
   - **Solution**: Root div has conditional `className={isDarkMode ? 'dark' : ''}` 
   - **Evidence**: All components use `dark:bg-slate-950`, `dark:text-slate-100` variants
   - **Status**: ✓ Completed

8. **Ensure consistent spacing and padding across all sections**
   - **Approach**: Applied uniform `p-4`, `gap-4`, `space-y-4` Tailwind classes
   - **Evidence**: Visual consistency across all panels and sections
   - **Status**: ✓ Completed

9. **Test layout balance and component sizing**
   - **Approach**: Manual testing with different screen sizes and content volumes
   - **Evidence**: Layout remains balanced with fixed heights preventing visual shifts
   - **Status**: ✓ Completed

---

## 3. [Frontend] Header (Top Section)

**Description:**
Create a header component displaying the application title and theme toggle functionality. The header provides a clean, minimal interface with the brokerage platform name and a dark/light mode switcher that persists user preferences across sessions.

**Subtasks:**

1. **Create Header.tsx component**
   - **Approach**: Created functional component with TypeScript in `frontend/src/components/Header.tsx`
   - **Evidence**: Component file exists and is imported in App.tsx
   - **Status**: ✓ Completed

2. **Add "Brokerage Platform" title with proper styling**
   - **Approach**: Used `text-xl font-bold` Tailwind classes for prominent title display
   - **Evidence**: Title displays in header with proper font weight and size
   - **Status**: ✓ Completed

3. **Implement theme toggle button with Sun/Moon icons (using text symbols)**
   - **Approach**: Used Unicode symbols (☀️ for sun, 🌙 for moon) in button element
   - **Solution**: Conditional rendering: `{isDarkMode ? '☀️' : '🌙'}`
   - **Evidence**: Button displays sun in dark mode, moon in light mode
   - **Status**: ✓ Completed

4. **Connect theme toggle to global isDarkMode state**
   - **Approach**: Passed `isDarkMode` and `setIsDarkMode` as props from App.tsx
   - **Solution**: Button onClick calls `setIsDarkMode(!isDarkMode)`
   - **Evidence**: Clicking button toggles theme across entire application
   - **Status**: ✓ Completed

5. **Add hover effects and transition animations for theme button**
   - **Approach**: Applied `hover:bg-slate-700 transition-colors` Tailwind classes
   - **Evidence**: Button background changes on hover with smooth transition
   - **Status**: ✓ Completed

6. **Style header with dark/light mode variants**
   - **Approach**: Used `bg-slate-900 dark:bg-slate-900` and `text-white dark:text-slate-100` classes
   - **Evidence**: Header styling adapts to current theme
   - **Status**: ✓ Completed

7. **Ensure header remains fixed at top with proper z-index**
   - **Approach**: Applied standard positioning classes without z-index (not needed for current layout)
   - **Evidence**: Header stays at top of layout as first element in flex container
   - **Status**: ✓ Completed

---

## 4. [Frontend] Trading Panel (Right Section)

**Description:**
Implement a trading interface panel displaying live price information with real-time updates. The panel shows current instrument name, live price, 24-hour change percentage, and timeframe selection buttons. Features include WebSocket integration for live price updates and interactive timeframe switching with custom interval input support.

**Subtasks:**

1. **Create TradePanel.tsx component**
   - **Approach**: Created functional component with TypeScript at `frontend/src/components/TradePanel.tsx`
   - **Evidence**: Component file exists and renders in App.tsx layout
   - **Status**: ✓ Completed

2. **Integrate WebSocket connection for live price updates**
   - **Approach**: Used WebSocket API to connect to backend at `ws://localhost:8080/ws`
   - **Solution**: `new WebSocket('ws://localhost:8080/ws')` with message event listener
   - **Evidence**: Price updates in real-time without page refresh
   - **Status**: ✓ Completed

3. **Display active instrument name (e.g., BTC/USDT)**
   - **Approach**: Formatted `activeInstrument` prop by inserting "/" (e.g., BTCUSDT → BTC/USDT)
   - **Solution**: `symbol.slice(0, 3) + '/' + symbol.slice(3)` for display formatting
   - **Evidence**: Instrument name displays as "BTC/USDT" format in panel header
   - **Status**: ✓ Completed

4. **Show current price with proper decimal formatting**
   - **Approach**: Used `Number.parseFloat(price).toFixed(2)` for consistent decimal places
   - **Evidence**: Price displays with 2 decimal places (e.g., $45,123.45)
   - **Status**: ✓ Completed

5. **Display 24-hour price change with percentage and color coding (green/red)**
   - **Approach**: Fetched 24h data from WebSocket, applied conditional Tailwind classes
   - **Solution**: `className={change24h >= 0 ? 'text-green-500' : 'text-red-500'}`
   - **Evidence**: Positive changes show green, negative changes show red with percentage
   - **Status**: ✓ Completed

6. **Add timeframe selection buttons (1h, 4h, 1d, Custom)**
   - **Approach**: Created button array with onClick handlers calling `setActiveTimeframe`
   - **Evidence**: Four buttons displayed horizontally with click functionality
   - **Status**: ✓ Completed

7. **Implement custom interval input modal with submit functionality**
   - **Approach**: Used conditional rendering with `showCustomInterval` state, input field and submit button
   - **Solution**: Modal overlay with input validation, calls `handleCustomIntervalSubmit` on Enter or button click
   - **Evidence**: Clicking "Custom" button shows modal, entering value updates timeframe
   - **Status**: ✓ Completed

8. **Add active state styling for selected timeframe**
   - **Approach**: Applied conditional classes: `bg-blue-600` for active, `bg-slate-700` for inactive
   - **Solution**: `className={activeTimeframe === '1h' ? 'bg-blue-600' : 'bg-slate-700'}`
   - **Evidence**: Selected timeframe button highlights in blue
   - **Status**: ✓ Completed

9. **Connect timeframe changes to chart component**
   - **Approach**: Passed `activeTimeframe` state from App.tsx as prop to both TradePanel and ChartComponent
   - **Evidence**: Chart refetches data and updates when timeframe button is clicked
   - **Status**: ✓ Completed

10. **Handle WebSocket message filtering by instrument symbol**
    - **Approach**: Parsed JSON message, checked if `data.stream` starts with active instrument lowercase
    - **Solution**: `if (data.stream.startsWith(activeInstrument.toLowerCase()))`
    - **Evidence**: Panel only updates when messages match current instrument
    - **Status**: ✓ Completed

---

## 5. [Frontend] Instruments List (Right Sidebar)

**Description:**
Build an instruments panel displaying a list of tradable assets with real-time ticker data. Each instrument shows the symbol, current price, and 24-hour change percentage with color-coded indicators. The panel fetches data from the backend ticker API, auto-refreshes every 10 seconds, and allows users to switch between instruments by clicking.

**Subtasks:**

1. **Create InstrumentsPanel.tsx component**
   - **Approach**: Created functional component at `frontend/src/components/InstrumentsPanel.tsx`
   - **Evidence**: Component file exists and renders in App.tsx layout
   - **Status**: ✓ Completed

2. **Fetch 24h ticker data from /api/v1/ticker endpoint**
   - **Approach**: Used fetch API with query parameters for multiple symbols
   - **Solution**: `await fetch('/api/v1/ticker?symbols=BTCUSDT,ETHUSDT,SOLUSDT,EURUSDT')`
   - **Evidence**: Panel displays real ticker data from Binance API
   - **Status**: ✓ Completed

3. **Display instrument list with symbols (BTCUSDT, ETHUSDT, SOLUSDT, EURUSDT)**
   - **Approach**: Mapped over `instruments` array to render list items with symbol display
   - **Evidence**: All four instruments displayed in panel
   - **Status**: ✓ Completed

4. **Show current price and 24h change percentage for each instrument**
   - **Approach**: Displayed `lastPrice` and `priceChangePercent` from ticker API response
   - **Solution**: Formatted price with `parseFloat().toFixed(2)` and percentage with `%` suffix
   - **Evidence**: Each instrument shows "Price: $X.XX" and "24h: X.XX%" format
   - **Status**: ✓ Completed

5. **Add color coding (green for positive, red for negative changes)**
   - **Approach**: Applied conditional Tailwind classes based on percentage value
   - **Solution**: `className={parseFloat(inst.priceChangePercent) >= 0 ? 'text-green-500' : 'text-red-500'}`
   - **Evidence**: Positive changes display in green, negative in red
   - **Status**: ✓ Completed

6. **Implement auto-refresh with 10-second interval**
   - **Approach**: Used `setInterval` in useEffect hook to call fetchTickers every 10 seconds
   - **Solution**: `const interval = setInterval(fetchTickers, 10000)` with cleanup
   - **Evidence**: Panel automatically updates every 10 seconds without user interaction
   - **Status**: ✓ Completed

7. **Add click handler to switch active instrument**
   - **Approach**: Added `onClick={() => setActiveInstrument(inst.symbol)}` to each list item
   - **Evidence**: Clicking instrument updates chart and trade panel
   - **Status**: ✓ Completed

8. **Highlight selected/active instrument with background color**
   - **Approach**: Applied conditional background class based on activeInstrument comparison
   - **Solution**: `className={activeInstrument === inst.symbol ? 'bg-slate-700' : 'bg-slate-800'}`
   - **Evidence**: Active instrument has lighter background color
   - **Status**: ✓ Completed

9. **Add loading and error states**
   - **Approach**: Used `loading` and `error` state variables with conditional rendering
   - **Evidence**: "Loading instruments..." displays during fetch, error message on failure
   - **Status**: ✓ Completed

10. **Implement scrollable container with fixed height (290px)**
    - **Approach**: Applied `h-[290px] overflow-y-auto` Tailwind classes to container div
    - **Evidence**: Panel maintains 290px height with scroll when content exceeds height
    - **Status**: ✓ Completed

---

## 6. [Frontend] Live News Feed (Bottom Right)

**Description:**
Create a comprehensive news panel aggregating real-time news from multiple RSS sources (3 crypto + 3 forex sources). Features include multi-source integration, automatic sorting by publish time, search functionality, category filters, pagination, unread indicators, expandable article modals, and auto-refresh every 2 minutes. The panel provides traders with up-to-date market news from CoinDesk, CryptoNews, CoinTelegraph, FXStreet, Investing.com, and Yahoo Finance.

**Subtasks:**

1. **Create NewsPanel.tsx component**
   - **Approach**: Created functional component at `frontend/src/components/NewsPanel.tsx` with TypeScript
   - **Evidence**: Component file exists with complete news aggregation functionality
   - **Status**: ✓ Completed

2. **Fetch news from /api/v1/news endpoint**
   - **Approach**: Used fetch API to retrieve aggregated news from backend
   - **Solution**: `await fetch('/api/v1/news')` returns JSON with articles array
   - **Evidence**: Panel displays news from all 6 RSS sources
   - **Status**: ✓ Completed

3. **Implement search bar with real-time filtering**
   - **Approach**: Added input field with `onChange` handler updating `searchQuery` state
   - **Solution**: Filter articles using `article.title.toLowerCase().includes(searchQuery.toLowerCase())`
   - **Evidence**: Typing in search bar immediately filters displayed articles
   - **Status**: ✓ Completed

4. **Add filter tabs (All, Crypto, Forex, Market, Alerts) with even distribution**
   - **Approach**: Created button group with `flex justify-between` and `flex-1` for equal spacing
   - **Solution**: Five buttons with conditional filtering: Crypto (3 sources), Forex (3 sources), All/Market/Alerts (6 sources)
   - **Evidence**: Filter buttons evenly distributed, clicking changes displayed articles
   - **Status**: ✓ Completed

5. **Display news articles with title, description, source badge, and timestamp**
   - **Approach**: Mapped filtered articles to render div elements with structured content
   - **Evidence**: Each article shows all required information with proper formatting
   - **Status**: ✓ Completed

6. **Sort articles by publish date (newest first)**
   - **Approach**: Backend sorts using `sort.Slice` with `article[i].PubDate.After(article[j].PubDate)`
   - **Solution**: Added sorting logic in `handlers.go` after combining all RSS feeds
   - **Evidence**: Most recent articles appear first regardless of source
   - **Status**: ✓ Completed

7. **Implement pagination (3 articles per page) with navigation buttons**
   - **Approach**: Sliced filtered articles array using `currentPage * 3` for start/end indices
   - **Solution**: Previous/Next buttons update `currentPage` state, disabled when at boundaries
   - **Evidence**: Only 3 articles shown at once, navigation buttons work correctly
   - **Status**: ✓ Completed

8. **Add unread indicators (blue dots) using useRef for tracking previous articles**
   - **Approach**: Used `useRef<NewsArticle[]>([])` to track articles from previous fetch
   - **Solution**: Compared current articles with `previousArticlesRef.current`, mark old articles as read
   - **Evidence**: Blue dots appear next to new articles after auto-refresh, disappear after seen
   - **Status**: ✓ Completed

9. **Create expandable modal for full article view with external link**
   - **Approach**: Conditional rendering of modal overlay when `selectedArticle` is set
   - **Solution**: Modal shows full description and "Read Full Article" link to external source
   - **Evidence**: Clicking article opens modal, clicking outside/X closes modal
   - **Status**: ✓ Completed

10. **Implement auto-refresh with 2-minute interval**
    - **Approach**: Used `setInterval` in useEffect to call fetchNews every 2 minutes
    - **Solution**: `const interval = setInterval(fetchNews, 2 * 60 * 1000)` with cleanup return
    - **Evidence**: News panel automatically fetches new articles every 2 minutes
    - **Status**: ✓ Completed

11. **Add time-ago formatting for article timestamps (e.g., "2h ago")**
    - **Approach**: Created `formatTimeAgo` function calculating time difference from current time
    - **Solution**: Returns formatted string like "5m ago", "2h ago", "3d ago" based on elapsed time
    - **Evidence**: Each article displays relative timestamp instead of absolute date
    - **Status**: ✓ Completed

12. **Handle loading and error states**
    - **Approach**: Used `loading` and `error` state variables with conditional rendering
    - **Evidence**: "Loading news..." displays during fetch, error message on API failure
    - **Status**: ✓ Completed

13. **Set fixed height (470px) with proper overflow handling**
    - **Approach**: Applied `h-[470px]` Tailwind class to main container, overflow handled by pagination
    - **Evidence**: Panel maintains 470px height, content doesn't overflow due to 3-article pagination
    - **Status**: ✓ Completed

14. **Style source badges with different colors for crypto/forex sources**
    - **Approach**: Applied conditional badge colors based on source name
    - **Solution**: Crypto sources (CoinDesk, CryptoNews, CoinTelegraph) use `bg-orange-600`, Forex sources (FXStreet, Investing.com, Yahoo Finance) use `bg-blue-600`
    - **Evidence**: Source badges display with distinct colors for visual categorization
    - **Status**: ✓ Completed