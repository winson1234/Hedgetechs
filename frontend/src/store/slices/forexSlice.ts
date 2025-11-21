import { apiFetch } from '../../utils/api';
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface ForexQuote {
  symbol: string;
  bid: number;
  ask: number;
  spread: number; // In pips
  change24h: number; // Percentage
  high24h: number;
  low24h: number;
  rangePips: number; // 24h high-low range in pips
  sessions: string[]; // Active trading sessions
  lastUpdated: number; // Unix timestamp (milliseconds)
}

export interface ForexKline {
  timestamp: string; // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ForexState {
  quotes: Record<string, ForexQuote>; // symbol -> quote
  klines: Record<string, ForexKline[]>; // symbol -> historical klines
  activeSessions: string[]; // Current active trading sessions
  selectedSymbol: string | null; // Currently selected symbol for chart
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: ForexState = {
  quotes: {},
  klines: {},
  activeSessions: [],
  selectedSymbol: null,
  loading: false,
  error: null,
};

// Async thunk to fetch all forex quotes
export const fetchForexQuotes = createAsyncThunk(
  'forex/fetchQuotes',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiFetch('api/v1/forex/quotes');
      if (!response.ok) throw new Error('Failed to fetch forex quotes');
      const data = await response.json();
      return data.quotes as ForexQuote[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch forex quotes';
      return rejectWithValue(message);
    }
  }
);

// Async thunk to fetch historical klines for a symbol
export const fetchForexKlines = createAsyncThunk(
  'forex/fetchKlines',
  async ({ symbol, interval = '1h', limit = 100 }: { symbol: string; interval?: string; limit?: number }, { rejectWithValue }) => {
    try {
      const response = await apiFetch(`api/v1/forex/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch forex klines');
      const data = await response.json();
      return { symbol, klines: data as ForexKline[] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch forex klines';
      return rejectWithValue(message);
    }
  }
);

// Forex slice
const forexSlice = createSlice({
  name: 'forex',
  initialState,
  reducers: {
    // Update single quote (called by WebSocket middleware)
    updateForexQuote: (state, action: PayloadAction<{ symbol: string; bid: number; ask: number; timestamp: number }>) => {
      const { symbol, bid, ask, timestamp } = action.payload;

      // Update existing quote or create new one
      if (state.quotes[symbol]) {
        state.quotes[symbol].bid = bid;
        state.quotes[symbol].ask = ask;
        state.quotes[symbol].lastUpdated = timestamp;

        // Recalculate spread in pips
        const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
        state.quotes[symbol].spread = (ask - bid) / pipSize;
      } else {
        // Initialize new quote with minimal data (will be filled by fetchForexQuotes)
        const pipSize = symbol.includes('JPY') ? 0.01 : 0.0001;
        state.quotes[symbol] = {
          symbol,
          bid,
          ask,
          spread: (ask - bid) / pipSize,
          change24h: 0,
          high24h: 0,
          low24h: 0,
          rangePips: 0,
          sessions: [],
          lastUpdated: timestamp,
        };
      }
    },

    // Set selected symbol for chart
    setSelectedSymbol: (state, action: PayloadAction<string | null>) => {
      state.selectedSymbol = action.payload;
    },

    // Clear all forex data
    clearForexData: (state) => {
      state.quotes = {};
      state.klines = {};
      state.activeSessions = [];
      state.selectedSymbol = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch forex quotes
    builder.addCase(fetchForexQuotes.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchForexQuotes.fulfilled, (state, action) => {
      state.loading = false;

      // Update quotes
      action.payload.forEach((quote) => {
        state.quotes[quote.symbol] = quote;
      });

      // Extract active sessions from first quote (all quotes have same sessions)
      if (action.payload.length > 0) {
        state.activeSessions = action.payload[0].sessions;
      }
    });
    builder.addCase(fetchForexQuotes.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Fetch forex klines
    builder.addCase(fetchForexKlines.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchForexKlines.fulfilled, (state, action) => {
      state.loading = false;
      const { symbol, klines } = action.payload;
      state.klines[symbol] = klines;
    });
    builder.addCase(fetchForexKlines.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

// Export actions
export const { updateForexQuote, setSelectedSymbol, clearForexData } = forexSlice.actions;

// Export reducer
export default forexSlice.reducer;
