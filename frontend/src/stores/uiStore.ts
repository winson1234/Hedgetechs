import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WalletTab, ToastState } from '../types'

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
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark });
        // Sync with HTML pages theme
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        // Apply theme to document
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.body.classList.add('dark-mode');
        } else {
          document.documentElement.classList.remove('dark');
          document.body.classList.remove('dark-mode');
        }
      },

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
      // Persist theme and wallet tab
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        activeWalletTab: state.activeWalletTab
      }),
    }
  )
)
