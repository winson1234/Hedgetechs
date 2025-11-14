import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProductType } from '../../types';

// Types
type Theme = 'light' | 'dark';
type Page = 'trading' | 'account' | 'wallet' | 'history';
type WalletTab = 'overview' | 'deposit' | 'withdraw' | 'transfer';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number; // Auto-dismiss after duration (ms), 0 = no auto-dismiss
}

interface UIState {
  theme: Theme;
  currentPage: Page;
  activeInstrument: string; // Currently selected trading instrument (e.g., 'BTCUSDT')
  selectedProductType: ProductType; // Currently selected product type for trading
  activeWalletTab: WalletTab; // Currently active wallet tab
  showAnalyticsPanel: boolean; // Analytics panel visibility
  isSidebarExpanded: boolean; // Sidebar expansion state
  positionsRefreshTrigger: number; // Trigger to refresh positions
  toasts: Toast[];
  modals: {
    openAccountModal: boolean;
    depositModal: boolean;
    withdrawModal: boolean;
  };
}

// Initial state
const initialState: UIState = {
  theme: 'light', // Default theme
  currentPage: 'trading',
  activeInstrument: 'BTCUSDT', // Default to Bitcoin
  selectedProductType: 'spot', // Default to SPOT trading
  activeWalletTab: 'overview',
  showAnalyticsPanel: false,
  isSidebarExpanded: false, // Default to collapsed
  positionsRefreshTrigger: 0,
  toasts: [],
  modals: {
    openAccountModal: false,
    depositModal: false,
    withdrawModal: false,
  },
};

// UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },

    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },

    // Page navigation
    setCurrentPage: (state, action: PayloadAction<Page>) => {
      state.currentPage = action.payload;
    },

    // Active instrument (trading symbol)
    setActiveInstrument: (state, action: PayloadAction<string>) => {
      state.activeInstrument = action.payload;
    },

    // Product type selection
    setSelectedProductType: (state, action: PayloadAction<ProductType>) => {
      state.selectedProductType = action.payload;
    },

    // Active wallet tab
    setActiveWalletTab: (state, action: PayloadAction<WalletTab>) => {
      state.activeWalletTab = action.payload;
    },

    // Analytics panel
    setShowAnalyticsPanel: (state, action: PayloadAction<boolean>) => {
      state.showAnalyticsPanel = action.payload;
    },

    toggleAnalyticsPanel: (state) => {
      state.showAnalyticsPanel = !state.showAnalyticsPanel;
    },

    // Sidebar
    setSidebarExpanded: (state, action: PayloadAction<boolean>) => {
      state.isSidebarExpanded = action.payload;
    },

    toggleSidebar: (state) => {
      state.isSidebarExpanded = !state.isSidebarExpanded;
    },

    // Toast notifications
    addToast: (state, action: PayloadAction<Omit<Toast, 'id'>>) => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
      state.toasts.push({
        id,
        ...action.payload,
      });
    },

    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },

    clearAllToasts: (state) => {
      state.toasts = [];
    },

    // Modals
    openModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = true;
    },

    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = false;
    },

    closeAllModals: (state) => {
      state.modals = {
        openAccountModal: false,
        depositModal: false,
        withdrawModal: false,
      };
    },

    // Positions refresh trigger
    triggerPositionsRefresh: (state) => {
      state.positionsRefreshTrigger += 1;
    },
  },
});

export const {
  setTheme,
  toggleTheme,
  setCurrentPage,
  setActiveInstrument,
  setSelectedProductType,
  setActiveWalletTab,
  setShowAnalyticsPanel,
  toggleAnalyticsPanel,
  setSidebarExpanded,
  toggleSidebar,
  addToast,
  removeToast,
  clearAllToasts,
  openModal,
  closeModal,
  closeAllModals,
  triggerPositionsRefresh,
} = uiSlice.actions;

// Selectors for computed values
export const selectIsDarkMode = (state: { ui: UIState }) => state.ui.theme === 'dark';

export default uiSlice.reducer;
