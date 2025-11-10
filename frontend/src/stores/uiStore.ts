import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WalletTab, ToastState, Drawing, DrawingState, LineStyle } from '../types'

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
  drawings: Drawing[]
  setDrawings: (drawings: Drawing[]) => void
  addDrawing: (drawing: Drawing) => void
  removeDrawing: (id: string) => void
  drawingState: DrawingState
  setDrawingState: (state: DrawingState) => void
  activeDrawingColor: string
  setActiveDrawingColor: (color: string) => void
  activeLineWidth: number
  setActiveLineWidth: (width: number) => void
  activeLineStyle: LineStyle
  setActiveLineStyle: (style: LineStyle) => void

  // Wallet
  activeWalletTab: WalletTab
  setActiveWalletTab: (tab: WalletTab) => void

  // Sidebar
  isSidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void

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
      isDarkMode: false,
      setDarkMode: (isDark) => {
        set({ isDarkMode: isDark });
        // Sync with HTML pages theme
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        // Apply theme to document
        if (isDark) {
          document.documentElement.classList.add('dark');
          document.body.classList.remove('light-mode');
        } else {
          document.documentElement.classList.remove('dark');
          document.body.classList.add('light-mode');
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
      drawings: [],
      setDrawings: (drawings) => set({ drawings }),
      addDrawing: (drawing) => set((state) => ({ drawings: [...state.drawings, drawing] })),
      removeDrawing: (id) => set((state) => ({ drawings: state.drawings.filter((d) => d.id !== id) })),
      drawingState: null,
      setDrawingState: (state) => set({ drawingState: state }),
      activeDrawingColor: '#3b82f6',
      setActiveDrawingColor: (color) => set({ activeDrawingColor: color }),
      activeLineWidth: 2,
      setActiveLineWidth: (width) => set({ activeLineWidth: width }),
      activeLineStyle: 'solid',
      setActiveLineStyle: (style) => set({ activeLineStyle: style }),

      // Wallet
      activeWalletTab: 'overview',
      setActiveWalletTab: (tab) => set({ activeWalletTab: tab }),

      // Sidebar
      isSidebarExpanded: false,
      setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),

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
      // Persist theme, wallet tab, and sidebar state
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        activeWalletTab: state.activeWalletTab,
        isSidebarExpanded: state.isSidebarExpanded
      }),
    }
  )
)
