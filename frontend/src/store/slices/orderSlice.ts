import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '../index';

// Types - Export for use in other components
export interface Order {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  order_number: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  amount_base: number;
  limit_price?: number | null;
  stop_price?: number | null;
  filled_amount: number;
  average_fill_price?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PendingOrder {
  id: string;
  user_id: string;
  account_id: string;
  order_number?: string;
  symbol: string;
  type: 'limit' | 'stop_limit';
  side: 'buy' | 'sell';
  quantity: number;
  trigger_price: number;
  limit_price?: number | null;
  status: 'pending' | 'executed' | 'cancelled' | 'expired' | 'failed';
  executed_at?: string | null;
  executed_price?: number | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderState {
  orders: Order[]; // Executed order history
  pendingOrders: PendingOrder[]; // Pending limit/stop-limit orders
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: OrderState = {
  orders: [],
  pendingOrders: [],
  loading: false,
  error: null,
};

// Helper to get auth token
const getAuthToken = (getState: () => RootState) => {
  const state = getState();
  return state.auth.session?.access_token || null;
};

// Async thunks

// Fetch order history
export const fetchOrders = createAsyncThunk(
  'order/fetchOrders',
  async (accountId: string, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/v1/orders?account_id=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      return data.orders;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch orders';
      return rejectWithValue(message);
    }
  }
);

// Fetch pending orders
export const fetchPendingOrders = createAsyncThunk(
  'order/fetchPendingOrders',
  async (accountId: string, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/v1/pending-orders?account_id=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch pending orders');
      const data = await response.json();
      return data.orders;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch pending orders';
      return rejectWithValue(message);
    }
  }
);

// Create pending order
export const createPendingOrder = createAsyncThunk(
  'order/createPendingOrder',
  async (
    orderData: {
      account_id: string;
      symbol: string;
      type: 'limit' | 'stop_limit';
      side: 'buy' | 'sell';
      quantity: number;
      trigger_price: number;
      limit_price?: number;
      leverage?: number; // Add leverage for CFD/Futures orders
      product_type: 'spot' | 'cfd' | 'futures'; // NEW: Product type at order level
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/v1/pending-orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) throw new Error('Failed to create pending order');
      const data = await response.json();
      return data.order;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create pending order';
      return rejectWithValue(message);
    }
  }
);

// Cancel pending order
export const cancelPendingOrder = createAsyncThunk(
  'order/cancelPendingOrder',
  async (orderId: string, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/v1/pending-orders/cancel?id=${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to cancel pending order');
      const data = await response.json();
      return data.order;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel pending order';
      return rejectWithValue(message);
    }
  }
);

// Execute market order
export const executeMarketOrder = createAsyncThunk(
  'order/executeMarketOrder',
  async (
    orderData: {
      account_id: string;
      symbol: string;
      side: 'buy' | 'sell';
      amount_base: number;
      current_price: number; // Current market price passed from frontend
      leverage?: number; // Add leverage for CFD orders
      product_type: 'spot' | 'cfd' | 'futures'; // NEW: Product type at order level
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: orderData.account_id,
          symbol: orderData.symbol,
          side: orderData.side,
          type: 'market',
          amount_base: orderData.amount_base,
          limit_price: orderData.current_price, // Pass current price for market execution
          leverage: orderData.leverage || 1, // Pass leverage for CFD
          product_type: orderData.product_type, // NEW: Product type at order level
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to execute market order');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute market order';
      return rejectWithValue(message);
    }
  }
);

// Order slice
const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Clear orders (on logout or account switch)
    clearOrders: (state) => {
      state.orders = [];
      state.pendingOrders = [];
    },
  },
  extraReducers: (builder) => {
    // Fetch orders
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.orders = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Fetch pending orders
    builder
      .addCase(fetchPendingOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPendingOrders.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingOrders = action.payload;
      })
      .addCase(fetchPendingOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create pending order
    builder
      .addCase(createPendingOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createPendingOrder.fulfilled, (state, action) => {
        state.loading = false;
        state.pendingOrders.push(action.payload);
      })
      .addCase(createPendingOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Cancel pending order
    builder
      .addCase(cancelPendingOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(cancelPendingOrder.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.pendingOrders.findIndex((order) => order.id === action.payload.id);
        if (index !== -1) {
          state.pendingOrders[index] = action.payload;
        }
      })
      .addCase(cancelPendingOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Execute market order
    builder
      .addCase(executeMarketOrder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(executeMarketOrder.fulfilled, (state, action) => {
        state.loading = false;
        // Add executed order to history
        if (action.payload.order) {
          state.orders.unshift(action.payload.order);
        }
      })
      .addCase(executeMarketOrder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, clearOrders } = orderSlice.actions;
export default orderSlice.reducer;
