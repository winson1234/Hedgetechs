import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type { BackendAccount, BackendBalance } from '../../types';
import { apiFetch } from '../../utils/api';

// Re-export centralized types for backward compatibility
export type Balance = BackendBalance;
export type Account = BackendAccount & {
  nickname?: string | null;
  color?: string | null;
  icon?: string | null;
  last_accessed_at?: string | null;
  access_count: number;
};

interface AccountState {
  accounts: Account[];
  activeAccountId: string | null;
  loading: boolean;
  error: string | null;
}

// Load active account from localStorage
const loadActiveAccountId = (): string | null => {
  try {
    const stored = localStorage.getItem('activeAccountId');
    return stored;
  } catch {
    return null;
  }
};

// Initial state
const initialState: AccountState = {
  accounts: [],
  activeAccountId: loadActiveAccountId(),
  loading: false,
  error: null,
};

// Helper to get auth token from state
const getAuthToken = (getState: () => RootState) => {
  const state = getState();
  return state.auth.token || null;
};

// Async thunks

// Fetch accounts
export const fetchAccounts = createAsyncThunk(
  'account/fetchAccounts',
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch('api/v1/accounts', {
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
    { type, currency, initial_balance }: {
      type: 'live' | 'demo';
      currency: string;
      initial_balance: number;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch('api/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          // product_type omitted - creates universal account (NULL in database)
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

// Toggle account status (activate/deactivate)
export const toggleAccountStatus = createAsyncThunk(
  'account/toggleAccountStatus',
  async (
    accountId: string,
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch(`api/v1/accounts/toggle-status?account_id=${accountId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to toggle account status');
      const data = await response.json();
      return data.accounts; // Backend returns updated list of all accounts
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle account status';
      return rejectWithValue(message);
    }
  }
);

// Edit demo account balance
export const editDemoBalance = createAsyncThunk(
  'account/editDemoBalance',
  async (
    { accountId, newBalance }: { accountId: string; newBalance: number },
    { getState, rejectWithValue, dispatch }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await apiFetch('api/v1/accounts/demo/edit-balance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account_id: accountId, new_balance: newBalance }),
      });

      if (!response.ok) throw new Error('Failed to edit demo balance');
      const data = await response.json();

      // Refresh accounts list to get updated balances
      await dispatch(fetchAccounts());

      return data.message;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to edit demo balance';
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
      // Persist to localStorage
      try {
        localStorage.setItem('activeAccountId', action.payload);
      } catch (error) {
        console.error('Failed to save active account to localStorage:', error);
      }
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },

    // Clear accounts (on logout)
    clearAccounts: (state) => {
      state.accounts = [];
      state.activeAccountId = null;
      // Clear from localStorage
      try {
        localStorage.removeItem('activeAccountId');
      } catch (error) {
        console.error('Failed to clear active account from localStorage:', error);
      }
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

        // Validate activeAccountId still exists in accounts
        const accountExists = state.activeAccountId && action.payload.some((acc: Account) => acc.id === state.activeAccountId);

        if (!accountExists && action.payload.length > 0) {
          // Set active account to first account if none selected or invalid
          state.activeAccountId = action.payload[0].id;
          // Persist to localStorage
          try {
            localStorage.setItem('activeAccountId', action.payload[0].id);
          } catch (error) {
            console.error('Failed to save active account to localStorage:', error);
          }
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

    // Toggle account status
    builder
      .addCase(toggleAccountStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleAccountStatus.fulfilled, (state, action) => {
        state.loading = false;
        // Backend returns updated list of all accounts
        const oldAccounts = state.accounts;
        state.accounts = action.payload;

        // If an account was activated (changed from deactivated to active),
        // automatically set it as the active account
        const activatedAccount = action.payload.find((newAcc: Account) => {
          const oldAcc = oldAccounts.find((old: Account) => old.id === newAcc.id);
          return oldAcc?.status !== 'active' && newAcc.status === 'active';
        });

        if (activatedAccount) {
          state.activeAccountId = activatedAccount.id;
          // Persist to localStorage
          try {
            localStorage.setItem('activeAccountId', activatedAccount.id);
          } catch (error) {
            console.error('Failed to save active account to localStorage:', error);
          }
        }
      })
      .addCase(toggleAccountStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Edit demo balance
    builder
      .addCase(editDemoBalance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(editDemoBalance.fulfilled, (state) => {
        state.loading = false;
        // Accounts refreshed by fetchAccounts() call in thunk
      })
      .addCase(editDemoBalance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setActiveAccount, clearError, clearAccounts } = accountSlice.actions;
export default accountSlice.reducer;
