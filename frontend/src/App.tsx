import { useEffect, useRef } from 'react';
import { getApiUrl } from './config/api';
import LivePriceDisplay from './components/LivePriceDisplay';
import ChartComponent from './components/ChartComponent';
import TradingPanel from './components/TradingPanel';
import InstrumentsPanel from './components/InstrumentsPanel';
import NewsPanel from './components/NewsPanel';
import Header from './components/Header';
import MarketActivityPanel from './components/MarketActivityPanel';
import LeftToolbar from './components/LeftToolbar';
import AnalyticsPanel from './components/AnalyticsPanel';
import MainSidebar from './components/MainSidebar';
import AccountPage from './components/AccountPage';
import ToastNotification from './components/ToastNotification';
import WalletPage from './pages/WalletPage';
import HistoryPage from './pages/HistoryPage';
import { usePriceStore } from './stores/priceStore';
import { useUIStore } from './stores/uiStore';
import type { Page } from './types';

export default function App() {
  // Access stores
  const isDarkMode = useUIStore(state => state.isDarkMode);
  const currentPage = useUIStore(state => state.currentPage);
  const activeInstrument = useUIStore(state => state.activeInstrument);
  const toast = useUIStore(state => state.toast);
  const hideToast = useUIStore(state => state.hideToast);
  
  // Track if we've already handled initial navigation
  const hasInitialized = useRef(false);

  // On initial load, check URL parameters and handle routing FIRST (before any redirects)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('page');
    
    if (pageParam) {
      // If there's a page parameter, navigate to that page
      const validPages: Page[] = ['dashboard', 'trading', 'account', 'wallet', 'history'];
      if (validPages.includes(pageParam as Page)) {
        useUIStore.getState().setCurrentPage(pageParam as Page);
        // Clean up URL by removing the page parameter
        window.history.replaceState({}, '', '/');
        return; // Don't do any dashboard redirect
      }
    }
    
    // No page parameter - check if this is direct access to root
    const isDirectAccess = window.location.pathname === '/' || window.location.pathname === '/index.html';
    const referrer = document.referrer;
    const fromHtmlPage = referrer && (
      referrer.includes('/dashboard.html') ||
      referrer.includes('/profile.html') || 
      referrer.includes('/securitySettings.html') ||
      referrer.includes('/login.html') ||
      referrer.includes('/register.html')
    );
    
    // Only redirect to dashboard if it's a direct access without referrer from HTML pages
    if (isDirectAccess && !fromHtmlPage) {
      window.location.href = '/dashboard.html';
    }
  }, []); // Run only once on mount

  // Redirect to dashboard.html if currentPage is set to 'dashboard' (from MainSidebar/LeftToolbar)
  useEffect(() => {
    // Only redirect if initialization is done and user explicitly navigated to dashboard
    if (hasInitialized.current && currentPage === 'dashboard') {
      window.location.href = '/dashboard.html';
    }
  }, [currentPage]);

  // Initialize dark mode from localStorage theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      const isDark = savedTheme === 'dark';
      useUIStore.getState().setDarkMode(isDark);
    }
  }, []);

  // Hydrate price store with 24h ticker data on mount
  useEffect(() => {
    const hydratePrices = async () => {
      try {
        const response = await fetch(getApiUrl('/api/v1/ticker?symbols=BTCUSDT,ETHUSDT,SOLUSDT,EURUSDT'));
        if (!response.ok) throw new Error('Failed to fetch 24h ticker data');
        const data = await response.json();
        usePriceStore.getState().hydrateFrom24hData(data);
      } catch (err) {
        console.error('Failed to hydrate price store:', err);
        usePriceStore.setState({ loading: false });
      }
    };
    hydratePrices();
  }, []);

  // Note: Pending order processing is now handled in real-time by WebSocketContext
  // Orders are matched immediately on every price tick, not every 5 seconds

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Header />

        {currentPage === 'trading' ? (
          <LeftToolbar />
        ) : (
          <MainSidebar />
        )}

        {currentPage === 'trading' && (
          <AnalyticsPanel />
        )}

        {/* Main Content Area */}
        <div className={currentPage === 'trading' ? 'ml-14 pt-[60px]' : 'pt-[60px]'}>
          {/* Trading Page */}
          {currentPage === 'trading' && (
            <div className="px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4">
                {/* Chart + Market Activity - Takes full width on mobile, left half on tablet, 6 cols on xl */}
                <div className="md:col-span-2 xl:col-span-6 space-y-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 lg:p-5">
                    <div className="mb-5">
                      <LivePriceDisplay symbol={activeInstrument} />
                    </div>
                    <ChartComponent />
                  </div>
                  <div className="h-[300px] md:h-[360px] lg:h-[440px]">
                    <MarketActivityPanel />
                  </div>
                </div>

                {/* Trading Panel - Full width on mobile, right half on tablet, 3 cols on xl */}
                <div className="md:col-span-1 xl:col-span-3">
                  <div className="h-full min-h-[800px] lg:min-h-[1000px] xl:min-h-[1100px]">
                    <TradingPanel />
                  </div>
                </div>

                {/* Instruments + News - Full width on mobile, spans both on tablet, 3 cols on xl */}
                <div className="md:col-span-1 xl:col-span-3 space-y-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 lg:p-5 h-[500px] md:h-[600px] lg:h-[735px] overflow-y-auto">
                    <InstrumentsPanel />
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 lg:p-5 h-[400px] md:h-[450px] lg:h-[555px]">
                    <NewsPanel />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other Pages */}
          {currentPage !== 'trading' && (
            <div className="ml-24">
              {currentPage === 'account' && <AccountPage />}
              {currentPage === 'wallet' && <WalletPage />}
              {currentPage === 'history' && <HistoryPage />}
            </div>
          )}
        </div>

        {/* Toast Notification */}
        {toast && (
          <ToastNotification
            message={toast.message}
            type={toast.type}
            onClose={hideToast}
          />
        )}
      </div>
    </div>
  );
}
