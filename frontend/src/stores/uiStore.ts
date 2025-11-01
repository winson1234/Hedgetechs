import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Page, WalletTab, ToastState } from '../types'

interface UIStore {
  // Theme
  isDarkMode: boolean
  setDarkMode: (isDark: boolean) => void

  // Chart settings
  activeTimeframe: string
  setActiveTimeframe: (timeframe: string) => void
  showCustomInterval: boolean
  setShowCustomInterval: (show: boolean) => void
  customInterval: string
  setCustomInterval: (interval: string) => void

  // Trading instrument
  activeInstrument: string
  setActiveInstrument: (instrument: string) => void

  // Analytics
  showAnalyticsPanel: boolean
  setShowAnalyticsPanel: (show: boolean) => void

  // Drawing Tools
  activeDrawingTool: string | null
  setActiveDrawingTool: (tool: string | null) => void

  // Navigation
  currentPage: Page
  setCurrentPage: (page: Page) => void
  navigateTo: (page: Page, walletTab?: WalletTab) => void

  // Wallet
  activeWalletTab: WalletTab
  setActiveWalletTab: (tab: WalletTab) => void

  // Toast notifications
  toast: ToastState
  showToast: (message: string, type: 'success' | 'error') => void
  hideToast: () => void
}

let toastIdCounter = 0

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Theme
      isDarkMode: true,
      setDarkMode: (isDark) => set({ isDarkMode: isDark }),

      // Chart settings
      activeTimeframe: '1h',
      setActiveTimeframe: (timeframe) => set({ activeTimeframe: timeframe }),
      showCustomInterval: false,
      setShowCustomInterval: (show) => set({ showCustomInterval: show }),
      customInterval: '',
      setCustomInterval: (interval) => set({ customInterval: interval }),

      // Trading instrument
      activeInstrument: 'BTCUSDT',
      setActiveInstrument: (instrument) => set({ activeInstrument: instrument }),

      // Analytics
      showAnalyticsPanel: false,
      setShowAnalyticsPanel: (show) => set({ showAnalyticsPanel: show }),

      // Drawing Tools
      activeDrawingTool: null,
      setActiveDrawingTool: (tool) => set({ activeDrawingTool: tool }),

      // Navigation
      currentPage: 'trading',
      setCurrentPage: (page) => set({ currentPage: page }),
      navigateTo: (page, walletTab) => {
        set({ currentPage: page })
        if (walletTab) {
          set({ activeWalletTab: walletTab })
        }
      },

      // Wallet
      activeWalletTab: 'overview',
      setActiveWalletTab: (tab) => set({ activeWalletTab: tab }),

      // Toast notifications
      toast: null,
      showToast: (message, type) => {
        const id = ++toastIdCounter
        set({ toast: { id, message, type } })
      },
      hideToast: () => set({ toast: null }),
    }),
    {
      name: 'ui-store',
      // Only persist theme preference
      partialize: (state) => ({ isDarkMode: state.isDarkMode }),
    }
  )
)
