import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { Position } from '../../types';
import { apiFetch } from '../../utils/api';

interface PositionState {
  positions: Position[];
  loading: boolean;
  error: string | null;
}

const initialState: PositionState = {
  positions: [],
  loading: false,
  error: null,
};

// Helper to get auth token from state
const getAuthToken = (getState: () => RootState) => {
  const state = getState();
  return state.auth.token || null;
};

// Async thunks

// Fetch open positions for active account
export const fetchPositions = createAsyncThunk(
  'position/fetchPositions',
  async (
    { accountId, status = 'open' }: { accountId: string; status?: 'open' | 'closed' | 'liquidated' },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch(
        `api/v1/contracts?account_id=${accountId}&status=${status}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch positions');
      const data = await response.json();
      return data.contracts || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch positions';
      return rejectWithValue(message);
    }
  }
);

// Close a position
export const closePosition = createAsyncThunk(
  'position/closePosition',
  async (
    { contractId, closePrice }: { contractId: string; closePrice: number },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch(`api/v1/contracts/close?contract_id=${contractId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ close_price: closePrice }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to close position');
      }

      const data = await response.json();
      return { contractId, closedContract: data.contract };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close position';
      return rejectWithValue(message);
    }
  }
);

// Close a hedged pair (both long and short positions)
export const closePair = createAsyncThunk(
  'position/closePair',
  async (
    { pairId, closePrice }: { pairId: string; closePrice: number },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch(`api/v1/contracts/close-pair?pair_id=${pairId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ close_price: closePrice }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to close pair');
      }

      const data = await response.json();
      return { pairId, closedContracts: data.contracts };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to close pair';
      return rejectWithValue(message);
    }
  }
);

// Position slice
const positionSlice = createSlice({
  name: 'position',
  initialState,
  reducers: {
    // Update unrealized P&L for a position based on current price
    updatePositionPnL: (
      state,
      action: PayloadAction<{ positionId: string; currentPrice: number }>
    ) => {
      const { positionId, currentPrice } = action.payload;
      const position = state.positions.find(p => p.id === positionId);

      if (position) {
        // Calculate unrealized P&L
        let unrealizedPnL: number;
        if (position.side === 'long') {
          unrealizedPnL = (currentPrice - position.entry_price) * position.lot_size;
        } else {
          unrealizedPnL = (position.entry_price - currentPrice) * position.lot_size;
        }

        // Calculate ROE (Return on Equity) as percentage of margin
        const roe = (unrealizedPnL / position.margin_used) * 100;

        position.unrealized_pnl = unrealizedPnL;
        position.current_price = currentPrice;
        position.roe = roe;
      }
    },

    // Update all positions' P&L based on current prices
    updateAllPositionsPnL: (
      state,
      action: PayloadAction<Record<string, { price: number }>>
    ) => {
      const prices = action.payload;

      state.positions.forEach(position => {
        const priceData = prices[position.symbol];
        if (priceData) {
          const currentPrice = priceData.price;

          // Calculate unrealized P&L
          let unrealizedPnL: number;
          if (position.side === 'long') {
            unrealizedPnL = (currentPrice - position.entry_price) * position.lot_size;
          } else {
            unrealizedPnL = (position.entry_price - currentPrice) * position.lot_size;
          }

          // Calculate ROE
          const roe = (unrealizedPnL / position.margin_used) * 100;

          position.unrealized_pnl = unrealizedPnL;
          position.current_price = currentPrice;
          position.roe = roe;
        }
      });
    },

    // Remove a closed position from the list
    removePosition: (state, action: PayloadAction<string>) => {
      state.positions = state.positions.filter(p => p.id !== action.payload);
    },

    // Add or update a position (from WebSocket)
    upsertPosition: (state, action: PayloadAction<Position>) => {
      const index = state.positions.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state.positions[index] = action.payload;
      } else {
        state.positions.push(action.payload);
      }
    },

    // Clear all positions
    clearPositions: (state) => {
      state.positions = [];
    },
  },
  extraReducers: (builder) => {
    // Fetch positions
    builder
      .addCase(fetchPositions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPositions.fulfilled, (state, action) => {
        state.loading = false;
        state.positions = action.payload;
      })
      .addCase(fetchPositions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Close position
    builder
      .addCase(closePosition.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(closePosition.fulfilled, (state, action) => {
        state.loading = false;
        // Remove the closed position from the list
        state.positions = state.positions.filter(p => p.id !== action.payload.contractId);
      })
      .addCase(closePosition.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Close pair
    builder
      .addCase(closePair.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(closePair.fulfilled, (state, action) => {
        state.loading = false;
        // Remove both positions in the pair from the list
        state.positions = state.positions.filter(p => p.pair_id !== action.payload.pairId);
      })
      .addCase(closePair.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  updatePositionPnL,
  updateAllPositionsPnL,
  removePosition,
  upsertPosition,
  clearPositions,
} = positionSlice.actions;

// Selectors
export const selectPositions = (state: RootState) => state.position.positions;
export const selectPositionsLoading = (state: RootState) => state.position.loading;
export const selectPositionsError = (state: RootState) => state.position.error;

export const selectPositionsBySymbol = (symbol: string) => (state: RootState) =>
  state.position.positions.filter(p => p.symbol === symbol);

export const selectOpenPositions = (state: RootState) =>
  state.position.positions.filter(p => p.status === 'open');

export const selectTotalUnrealizedPnL = (state: RootState) =>
  state.position.positions.reduce((total, p) => total + (p.unrealized_pnl || 0), 0);

export default positionSlice.reducer;
