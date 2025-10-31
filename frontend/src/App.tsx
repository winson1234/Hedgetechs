import { useEffect } from 'react';
import LivePriceDisplay from './components/LivePriceDisplay';
import ChartComponent from './components/ChartComponent';
import TradingPanel from './components/TradingPanel';
import InstrumentsPanel from './components/InstrumentsPanel';
import NewsPanel from './components/NewsPanel';
import Header from './components/Header';
import OrderBookPanel from './components/OrderBookPanel';
import LeftToolbar from './components/LeftToolbar';
import AnalyticsPanel from './components/AnalyticsPanel';
import MainSidebar from './components/MainSidebar';
import AccountPage from './components/AccountPage';
import ToastNotification from './components/ToastNotification';
import WalletPage from './pages/WalletPage';
import { usePriceStore } from './stores/priceStore';
import { useUIStore } from './stores/uiStore';

export default function App() {
  // Access stores
  const isDarkMode = useUIStore(state => state.isDarkMode);
  const currentPage = useUIStore(state => state.currentPage);
  const activeInstrument = useUIStore(state => state.activeInstrument);
  const toast = useUIStore(state => state.toast);
  const hideToast = useUIStore(state => state.hideToast);

  // Hydrate price store with 24h ticker data on mount
  useEffect(() => {
    const hydratePrices = async () => {
      try {
        const response = await fetch('/api/v1/ticker?symbols=BTCUSDT,ETHUSDT,SOLUSDT,EURUSDT');
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
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
                    <div className="mb-5">
                      <LivePriceDisplay symbol={activeInstrument} />
                    </div>
                    <div className="h-[480px] md:h-[520px] lg:h-[566px]">
                      <ChartComponent />
                    </div>
                  </div>
                  <div className="h-[300px] md:h-[360px] lg:h-[440px]">
                    <OrderBookPanel />
                  </div>
                </div>
                <div className="lg:col-span-1">
                  <div className="h-full min-h-[800px] lg:min-h-[1000px] xl:min-h-[1100px]">
                    <TradingPanel />
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[500px] md:h-[600px] lg:h-[735px] overflow-y-auto">
                    <InstrumentsPanel />
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[400px] md:h-[450px] lg:h-[549px]">
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
