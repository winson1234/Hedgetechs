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

// WebSocket middleware
import { websocketMiddleware } from './middleware/websocket';

// Persist configuration - ONLY persist auth tokens for security
const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['user', 'session'], // Only persist user and session data
};

// Persist UI configuration - persist theme and sidebar state
const uiPersistConfig = {
  key: 'ui',
  storage,
  whitelist: ['theme', 'isSidebarExpanded'], // Only persist theme and sidebar state
};

// Create persisted reducers
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedUiReducer = persistReducer(uiPersistConfig, uiReducer);

// Configure store
export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    account: accountReducer,
    order: orderReducer,
    price: priceReducer,
    ui: persistedUiReducer,
    transaction: transactionReducer,
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
