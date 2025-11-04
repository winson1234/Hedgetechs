import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import Header from './Header';
import MainSidebar from './MainSidebar';
import LeftToolbar from './LeftToolbar';
import AnalyticsPanel from './AnalyticsPanel';
import ToastNotification from './ToastNotification';
import { usePriceStore } from '../stores/priceStore';
import { useUIStore } from '../stores/uiStore';

export default function AppLayout() {
  const location = useLocation();
  const isDarkMode = useUIStore(state => state.isDarkMode);
  const toast = useUIStore(state => state.toast);
  const hideToast = useUIStore(state => state.hideToast);

  // Determine if we're on the trading page
  const isTradingPage = location.pathname === '/trading';

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

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Header />

        {/* Show LeftToolbar for trading page, MainSidebar for other pages */}
        {isTradingPage ? <LeftToolbar /> : <MainSidebar />}

        {/* Show AnalyticsPanel only on trading page */}
        {isTradingPage && <AnalyticsPanel />}

        {/* Main Content Area */}
        <div className={isTradingPage ? 'ml-14 pt-[60px]' : 'ml-24 pt-[60px]'}>
          <Outlet />
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
