import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiFetch } from '../../utils/api';

// Types
interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

interface OrderBookLevel {
  price: number;
  quantity: number;
}

interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

interface Trade {
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
}

interface HistoricalPrice {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent?: string; // 24h price change percentage
  volume?: string; // 24h volume
}

interface TickerData {
  priceChangePercent: number; // 24h price change percentage
  volume24h: number; // 24h trading volume
}

interface PriceState {
  currentPrices: Record<string, PriceData>; // symbol -> price data
  tickers: Record<string, TickerData>; // symbol -> 24h ticker stats
  orderBooks: Record<string, OrderBookData>; // symbol -> order book
  trades: Record<string, Trade[]>; // symbol -> recent trades (max 50 per symbol)
  historicalPrices: Record<string, HistoricalPrice[]>; // symbol -> klines
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: PriceState = {
  currentPrices: {},
  tickers: {},
  orderBooks: {},
  trades: {},
  historicalPrices: {},
  loading: false,
  error: null,
};

// Async thunk to fetch historical prices (klines)
export const fetchHistoricalPrices = createAsyncThunk(
  'price/fetchHistoricalPrices',
  async ({ symbol, interval = '1h', limit = 100 }: { symbol: string; interval?: string; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await apiFetch(`api/v1/klines?symbols=${symbol}&interval=${interval}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch historical prices');
      const data = await response.json();
      return { symbol, klines: data.klines };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch historical prices';
      return rejectWithValue(message);
    }
  }
);

// Price slice
const priceSlice = createSlice({
  name: 'price',
  initialState,
  reducers: {
    // Update current price (called by WebSocket middleware)
    updateCurrentPrice: (state, action: PayloadAction<PriceData>) => {
      const { symbol, price, timestamp } = action.payload;
      state.currentPrices[symbol] = { symbol, price, timestamp };
    },

    // Hydrate from 24h ticker data
    hydrateFrom24hData: (state, action: PayloadAction<Ticker24h[]>) => {
      const timestamp = Date.now();
      action.payload.forEach((ticker) => {
        state.currentPrices[ticker.symbol] = {
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice),
          timestamp,
        };

        // Store ticker statistics (percentage change and volume)
        state.tickers[ticker.symbol] = {
          priceChangePercent: ticker.priceChangePercent ? parseFloat(ticker.priceChangePercent) : 0,
          volume24h: ticker.volume ? parseFloat(ticker.volume) : 0,
        };
      });
      state.loading = false;
    },

    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },

    // Update order book (called by WebSocket middleware)
    updateOrderBook: (state, action: PayloadAction<OrderBookData>) => {
      const { symbol, bids, asks } = action.payload;
      state.orderBooks[symbol] = { symbol, bids, asks };
    },

    // Add trade (called by WebSocket middleware)
    addTrade: (state, action: PayloadAction<{ symbol: string; trade: Trade }>) => {
      const { symbol, trade } = action.payload;
      if (!state.trades[symbol]) {
        state.trades[symbol] = [];
      }
      // Add to beginning and keep only last 50 trades
      state.trades[symbol] = [trade, ...state.trades[symbol]].slice(0, 50);
    },

    // Clear price data
    clearPriceData: (state) => {
      state.currentPrices = {};
      state.orderBooks = {};
      state.trades = {};
      state.historicalPrices = {};
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch historical prices
    builder
      .addCase(fetchHistoricalPrices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchHistoricalPrices.fulfilled, (state, action) => {
        state.loading = false;
        const { symbol, klines } = action.payload;
        state.historicalPrices[symbol] = klines;
      })
      .addCase(fetchHistoricalPrices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { updateCurrentPrice, hydrateFrom24hData, setLoading, updateOrderBook, addTrade, clearPriceData, clearError } = priceSlice.actions;
export default priceSlice.reducer;
