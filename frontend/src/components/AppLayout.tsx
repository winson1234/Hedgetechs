import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import MainSidebar from './MainSidebar';
import MobileBottomNav from './MobileBottomNav';
import AnalyticsPanel from './AnalyticsPanel';
import ToastNotification from './ToastNotification';
import { useAppDispatch, useAppSelector } from '../store';
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
