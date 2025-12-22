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
  // Remove migrate function - handle migration in reducer if needed
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
