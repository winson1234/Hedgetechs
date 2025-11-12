import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import type {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentMethodMetadata
} from '../../types';

// Re-export centralized types for backward compatibility
export type { Transaction, TransactionStatus, TransactionType, PaymentMethodMetadata };

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: TransactionState = {
  transactions: [],
  loading: false,
  error: null,
};

// Helper to get auth token
const getAuthToken = (getState: () => RootState) => {
  const state = getState();
  return state.auth.session?.access_token || null;
};

// Backend transaction type (snake_case with time.Time strings)
interface BackendTransaction {
  id: string;
  account_id: string;
  transaction_number: string;
  type: string;
  currency: string;
  amount: number;
  status: string;
  target_account_id?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  created_at: string; // ISO timestamp string
  updated_at: string;
}

// Backend transaction type (export for use in other components)
export type { BackendTransaction };

// Transform backend transaction to frontend format (export for use in batch history)
export const transformTransaction = (backend: BackendTransaction): Transaction => {
  return {
    id: backend.id,
    transactionNumber: backend.transaction_number,  // Human-readable number
    type: backend.type as TransactionType,
    status: backend.status as TransactionStatus,
    accountId: backend.account_id,
    amount: backend.amount,
    currency: backend.currency,
    timestamp: new Date(backend.created_at).getTime(), // Convert ISO string to milliseconds
    targetAccountId: backend.target_account_id,
    toAccountId: backend.target_account_id,
    description: backend.description,
    metadata: backend.metadata as PaymentMethodMetadata | undefined,
  };
};

// Async thunks

// Fetch transactions
export const fetchTransactions = createAsyncThunk(
  'transaction/fetchTransactions',
  async (accountId: string, { getState, rejectWithValue }) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/v1/transactions?account_id=${accountId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();

      // Transform backend transactions to frontend format
      const transactions = (data.transactions || []).map((txn: BackendTransaction) =>
        transformTransaction(txn)
      );

      return transactions;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch transactions';
      return rejectWithValue(message);
    }
  }
);

// Create deposit transaction
export const createDeposit = createAsyncThunk(
  'transaction/createDeposit',
  async (
    {
      accountId,
      amount,
      currency,
      paymentIntentId,
      metadata,
    }: {
      accountId: string;
      amount: number;
      currency: string;
      paymentIntentId?: string;
      metadata?: PaymentMethodMetadata;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          type: 'deposit',
          amount,
          currency,
          payment_intent_id: paymentIntentId,
          metadata,
        }),
      });

      if (!response.ok) throw new Error('Failed to create deposit');
      const data = await response.json();
      return transformTransaction(data.transaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create deposit';
      return rejectWithValue(message);
    }
  }
);

// Create withdrawal transaction
export const createWithdrawal = createAsyncThunk(
  'transaction/createWithdrawal',
  async (
    {
      accountId,
      amount,
      currency,
      metadata,
    }: {
      accountId: string;
      amount: number;
      currency: string;
      metadata?: PaymentMethodMetadata;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: accountId,
          type: 'withdraw',
          amount,
          currency,
          metadata,
        }),
      });

      if (!response.ok) throw new Error('Failed to create withdrawal');
      const data = await response.json();
      return transformTransaction(data.transaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create withdrawal';
      return rejectWithValue(message);
    }
  }
);

// Create transfer transaction
export const createTransfer = createAsyncThunk(
  'transaction/createTransfer',
  async (
    {
      fromAccountId,
      toAccountId,
      amount,
      currency,
    }: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      currency: string;
    },
    { getState, rejectWithValue }
  ) => {
    try {
      const token = getAuthToken(getState as () => RootState);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/v1/transactions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: fromAccountId,
          type: 'transfer',
          amount,
          currency,
          target_account_id: toAccountId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create transfer');
      const data = await response.json();
      return transformTransaction(data.transaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create transfer';
      return rejectWithValue(message);
    }
  }
);

// Transaction slice
const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    // Add transaction (for real-time updates)
    addTransaction: (state, action: PayloadAction<Transaction>) => {
      state.transactions.unshift(action.payload);
    },

    // Update transaction status
    updateTransactionStatus: (
      state,
      action: PayloadAction<{ id: string; status: TransactionStatus; errorMessage?: string }>
    ) => {
      const transaction = state.transactions.find((t) => t.id === action.payload.id);
      if (transaction) {
        transaction.status = action.payload.status;
        if (action.payload.errorMessage) {
          transaction.errorMessage = action.payload.errorMessage;
        }
      }
    },

    // Clear transactions
    clearTransactions: (state) => {
      state.transactions = [];
    },

    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch transactions
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create deposit
    builder
      .addCase(createDeposit.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createDeposit.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions.unshift(action.payload);
      })
      .addCase(createDeposit.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create withdrawal
    builder
      .addCase(createWithdrawal.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createWithdrawal.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions.unshift(action.payload);
      })
      .addCase(createWithdrawal.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Create transfer
    builder
      .addCase(createTransfer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTransfer.fulfilled, (state, action) => {
        state.loading = false;
        state.transactions.unshift(action.payload);
      })
      .addCase(createTransfer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  addTransaction,
  updateTransactionStatus,
  clearTransactions,
  clearError,
} = transactionSlice.actions;

export default transactionSlice.reducer;
