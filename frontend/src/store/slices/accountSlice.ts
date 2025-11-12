import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

// Types - Export for use in components
export interface Balance {
  id: string;
  account_id: string;
  currency: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  account_number: string;
  type: 'live' | 'demo';
  product_type: 'spot' | 'cfd' | 'futures';
  currency: string;
  status: 'active' | 'deactivated' | 'suspended';
  created_at: string;
  updated_at: string;
  nickname?: string | null;
  color?: string | null;
  icon?: string | null;
  last_accessed_at?: string | null;
  access_count: number;
  balances: Balance[];
}

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: AccountState = {
  accounts: [],
  activeAccountId: null,
  loading: false,
  error: null,
};

// Helper to get auth token from state
const getAuthToken = (getState: () => RootState) => {
  const state = getState();
  return state.auth.session?.access_token || null;
};

// Async thunks

// Fetch accounts
export const fetchAccounts = createAsyncThunk(
  'account/fetchAccounts',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/v1/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      return data.accounts;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch accounts';
      return rejectWithValue(message);
    }
  }
);

// Create account
export const createAccount = createAsyncThunk(
  'account/createAccount',
  async (
    { type, product_type, currency, initial_balance }: {
      type: 'live' | 'demo';
      product_type: 'spot' | 'cfd' | 'futures';
      currency: string;
      initial_balance: number;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          product_type,
          currency,
          initial_balance,
        }),
      });

      if (!response.ok) throw new Error('Failed to create account');
      const data = await response.json();
      return data.account;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create account';
      return rejectWithValue(message);
    }
  }
);

// Update account metadata (nickname, color, icon)
export const updateAccountMetadata = createAsyncThunk(
  'account/updateAccountMetadata',
  async (
    { id, nickname, color, icon }: {
      id: string;
      nickname?: string;
      color?: string;
      icon?: string;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/v1/accounts/metadata?id=${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname, color, icon }),
      });

      if (!response.ok) throw new Error('Failed to update account metadata');
      const data = await response.json();
      return data.account;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update account metadata';
      return rejectWithValue(message);
    }
  }
);

// Account slice
const accountSlice = createSlice({
  name: 'account',
  initialState,
  reducers: {
    // Set active account
    setActiveAccount: (state, action: PayloadAction<string>) => {
      state.activeAccountId = action.payload;
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Clear accounts (on logout)
    clearAccounts: (state) => {
      state.accounts = [];
      state.activeAccountId = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch accounts
    builder
      .addCase(fetchAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts = action.payload;

        // Set active account to first account if none selected
        if (!state.activeAccountId && action.payload.length > 0) {
          state.activeAccountId = action.payload[0].id;
        }
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create account
    builder
      .addCase(createAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.accounts.push(action.payload);

        // Set as active account if it's the first one
        if (state.accounts.length === 1) {
          state.activeAccountId = action.payload.id;
        }
      })
      .addCase(createAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Update account metadata
    builder
      .addCase(updateAccountMetadata.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateAccountMetadata.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.accounts.findIndex((acc) => acc.id === action.payload.id);
        if (index !== -1) {
          state.accounts[index] = action.payload;
        }
      })
      .addCase(updateAccountMetadata.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setActiveAccount, clearError, clearAccounts } = accountSlice.actions;
export default accountSlice.reducer;
