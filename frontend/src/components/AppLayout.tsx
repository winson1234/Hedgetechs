import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getApiUrl } from '../config/api';
import Header from './Header';
import MainSidebar from './MainSidebar';
import MobileBottomNav from './MobileBottomNav';
import AnalyticsPanel from './AnalyticsPanel';
import ToastNotification from './ToastNotification';
import { useAppDispatch, useAppSelector } from '../store';
import { hydrateFrom24hData, setLoading } from '../store/slices/priceSlice';
import { setTheme, removeToast, selectIsDarkMode } from '../store/slices/uiSlice';

export default function AppLayout() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isDarkMode = useAppSelector(selectIsDarkMode);
  const isSidebarExpanded = useAppSelector(state => state.ui.isSidebarExpanded);
  const toasts = useAppSelector(state => state.ui.toasts);

  // Determine if we're on the trading page
  const isTradingPage = location.pathname === '/trading';

  // Initialize dark mode from localStorage theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      dispatch(setTheme(savedTheme as 'light' | 'dark'));
    }
  }, [dispatch]);

  // Hydrate price store with 24h ticker data on mount (all 24 instruments)
  useEffect(() => {
    const hydratePrices = async () => {
      try {
        const symbols = 'BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT,XRPUSDT,ADAUSDT,AVAXUSDT,DOGEUSDT,MATICUSDT,LINKUSDT,UNIUSDT,ATOMUSDT,DOTUSDT,ARBUSDT,OPUSDT,APTUSDT,LTCUSDT,SHIBUSDT,NEARUSDT,ICPUSDT,FILUSDT,SUIUSDT,STXUSDT,TONUSDT';
        const response = await fetch(getApiUrl(`/api/v1/ticker?symbols=${symbols}`));
        if (!response.ok) throw new Error('Failed to fetch 24h ticker data');
        const data = await response.json();
        dispatch(hydrateFrom24hData(data));
      } catch (err) {
        console.error('Failed to hydrate price store:', err);
        dispatch(setLoading(false));
      }
    };
    hydratePrices();
  }, [dispatch]);

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Header />

        {/* Main Sidebar for desktop */}
        <MainSidebar />

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />

        {/* Show AnalyticsPanel only on trading page */}
        {isTradingPage && <AnalyticsPanel />}

        {/* Main Content Area */}
        <div className={`pt-8 pb-16 md:pb-8 transition-all duration-150 ${
          isSidebarExpanded ? 'md:ml-44' : 'md:ml-14'
        }`}>
          <Outlet />
        </div>

        {/* Toast Notifications */}
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => dispatch(removeToast(toast.id))}
          />
        ))}
      </div>
    </div>
  );
}
