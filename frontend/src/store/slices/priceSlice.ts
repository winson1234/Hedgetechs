import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

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

interface HistoricalPrice {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceState {
  currentPrices: Record<string, PriceData>; // symbol -> price data
  orderBooks: Record<string, OrderBookData>; // symbol -> order book
  historicalPrices: Record<string, HistoricalPrice[]>; // symbol -> klines
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: PriceState = {
  currentPrices: {},
  orderBooks: {},
  historicalPrices: {},
  loading: false,
  error: null,
};

// Async thunk to fetch historical prices (klines)
export const fetchHistoricalPrices = createAsyncThunk(
  'price/fetchHistoricalPrices',
  async ({ symbol, interval = '1h', limit = 100 }: { symbol: string; interval?: string; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/v1/klines?symbols=${symbol}&interval=${interval}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch historical prices');
      const data = await response.json();
      return { symbol, klines: data.klines };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch historical prices');
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
    hydrateFrom24hData: (state, action: PayloadAction<any[]>) => {
      const timestamp = Date.now();
      action.payload.forEach((ticker: any) => {
        state.currentPrices[ticker.symbol] = {
          symbol: ticker.symbol,
          price: parseFloat(ticker.lastPrice),
          timestamp,
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

    // Clear price data
    clearPriceData: (state) => {
      state.currentPrices = {};
      state.orderBooks = {};
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

export const { updateCurrentPrice, hydrateFrom24hData, setLoading, updateOrderBook, clearPriceData, clearError } = priceSlice.actions;
export default priceSlice.reducer;
