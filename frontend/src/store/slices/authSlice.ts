import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as authService from '../../services/auth';
import type { User } from '../../services/auth';

// State interface
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

// Async thunks for authentication

// Sign up
export const signUp = createAsyncThunk(
  'auth/signUp',
  async ({
    email,
    password,
    firstName,
    lastName,
    phoneNumber,
    country,
    userType
  }: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    country: string;
    userType: string;
  }, { rejectWithValue }) => {
    try {
      const result = await authService.register({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        country,
        user_type: userType,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return rejectWithValue(message);
    }
  }
);

// Sign in
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const result = await authService.login({ email, password });

      // Store user data
      authService.storeUser(result.user);

      return { user: result.user, token: result.token };
    } catch (error: any) {
      // Pass the fully structured error object from the service layer directly to the component.
      // The auth service already formats the error.
      return rejectWithValue(error);
    }
  }
);

// Sign out
export const signOut = createAsyncThunk(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      return rejectWithValue(message);
    }
  }
);

// Validate session
export const validateSession = createAsyncThunk(
  'auth/validateSession',
  async (_, { rejectWithValue }) => {
    try {
      const { user, isValid } = await authService.validateSession();
      const token = authService.getToken();

      if (!isValid || !user || !token) {
        return { user: null, token: null };
      }

      return { user, token };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Session validation failed';
      return rejectWithValue(message);
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    // Clear auth state completely
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
    },
    // Set auth state manually if needed
    setAuth: (state, action: PayloadAction<{ user: User | null; token: string | null }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = !!action.payload.user && !!action.payload.token;
    },
  },
  extraReducers: (builder) => {
    // Sign up (creates user account directly, no auth state change - user needs to log in)
    // Sign up (creates user account directly, no auth state change - user needs to log in)
    builder
      .addCase(signUp.pending, (state) => {
        state.error = null;
      })
      .addCase(signUp.fulfilled, () => {
        // Registration successful - user can now log in
      })
      .addCase(signUp.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Sign in
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        if (action.payload && typeof action.payload === 'object' && 'message' in (action.payload as any)) {
          state.error = (action.payload as any).message;
        } else {
          state.error = action.payload as string;
        }
      });

    // Sign out
    builder
      .addCase(signOut.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // Validate session
    builder
      .addCase(validateSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(validateSession.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = !!action.payload.user && !!action.payload.token;
      })
      .addCase(validateSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, clearAuth, setAuth } = authSlice.actions;
export default authSlice.reducer;
