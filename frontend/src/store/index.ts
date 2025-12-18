import { configureStore } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Create sessionStorage engine for redux-persist
// This ensures auth tokens are cleared when the tab closes
const sessionStorageEngine = {
  getItem: (key: string): Promise<string | null> => {
    return Promise.resolve(window.sessionStorage.getItem(key));
  },
  setItem: (key: string, value: string): Promise<void> => {
    return Promise.resolve(window.sessionStorage.setItem(key, value));
  },
  removeItem: (key: string): Promise<void> => {
    return Promise.resolve(window.sessionStorage.removeItem(key));
  },
};

// Import slices
import authReducer from './slices/authSlice';
import accountReducer from './slices/accountSlice';
import orderReducer from './slices/orderSlice';
import priceReducer from './slices/priceSlice';
import uiReducer from './slices/uiSlice';
import transactionReducer from './slices/transactionSlice';
import forexReducer from './slices/forexSlice';
import positionReducer from './slices/positionSlice';
import notificationReducer from './slices/notificationSlice';

// WebSocket middleware
import { websocketMiddleware } from './middleware/websocket';

// DO NOT persist auth state - we manage it directly from sessionStorage
// This ensures auth is completely cleared when tab closes
// Auth state will be restored from sessionStorage on app load via validateSession()

// Persist UI configuration - persist theme, sidebar state, and product type
const uiPersistConfig = {
  key: 'ui',
  storage,
  whitelist: ['theme', 'isSidebarExpanded', 'selectedProductType'], // Only persist theme, sidebar state, and product type
  version: 1,
  migrate: (state: any) => {
    // Migration: Force default product type to 'cfd' for all users
    if (state && state.selectedProductType === 'spot') {
      return {
        ...state,
        selectedProductType: 'cfd',
      };
    }
    return state;
  },
};

// Create persisted reducers
// Auth reducer is NOT persisted - managed directly from sessionStorage
const persistedUiReducer = persistReducer(uiPersistConfig, uiReducer);

// Configure store
export const store = configureStore({
  reducer: {
    auth: authReducer, // NOT persisted - managed from sessionStorage directly
    account: accountReducer,
    order: orderReducer,
    price: priceReducer,
    position: positionReducer,
    ui: persistedUiReducer,
    transaction: transactionReducer,
    forex: forexReducer,
    notification: notificationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(websocketMiddleware),
  devTools: import.meta.env.MODE !== 'production',
});

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export typed hooks (to be used instead of plain useDispatch and useSelector)
import { useDispatch, useSelector } from 'react-redux';
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
