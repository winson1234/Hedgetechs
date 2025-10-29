import { useState, useEffect, useCallback, useMemo } from 'react';
import LivePriceDisplay from './components/LivePriceDisplay';
import ChartComponent from './components/ChartComponent';
import TradingPanel from './components/TradingPanel';
import InstrumentsPanel from './components/InstrumentsPanel';
import NewsPanel from './components/NewsPanel';
import Header from './components/Header';
import OrderBookPanel from './components/OrderBookPanel';
import LeftToolbar from './components/LeftToolbar';
import AnalyticsPanel from './components/AnalyticsPanel';
import AccountPage from './components/AccountPage';
import ToastNotification from './components/ToastNotification';

// --- Type Definitions ---
export type Account = {
  id: string;
  type: 'live' | 'demo';
  currency: string;
  balances: Record<string, number>;
  createdAt: number;
};

type Page = 'trading' | 'account';

type ToastState = {
  id: number;
  message: string;
  type: 'success' | 'error';
} | null;

// --- Helper Functions ---
const generateAccountId = (type: 'live' | 'demo'): string => {
  const prefix = type === 'live' ? 'L' : 'D';
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
};

const getDefaultAccounts = (): Account[] => [
  {
    id: generateAccountId('live'),
    type: 'live',
    currency: 'USD',
    balances: { USD: 10000, BTC: 1, ETH: 5, SOL: 100 },
    createdAt: Date.now() - 200000,
  },
  {
    id: generateAccountId('demo'),
    type: 'demo',
    currency: 'USD',
    balances: { USD: 50000 },
    createdAt: Date.now(),
  },
];

const formatBalance = (balance: number | undefined, currency: string | undefined): string => {
    const numBalance = balance ?? 0;
    const displayCurrency = currency || 'USD';
    try {
      return numBalance.toLocaleString('en-US', {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch (e) {
      console.warn(`Could not format currency for code: ${displayCurrency}. Falling back.`);
      return `${numBalance.toFixed(2)} ${displayCurrency}`;
    }
};

// --- App Component ---
export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState('1h');
  const [showCustomInterval, setShowCustomInterval] = useState(false);
  const [customInterval, setCustomInterval] = useState('');
  const [activeInstrument, setActiveInstrument] = useState('BTCUSDT');
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('trading');
  const [toast, setToast] = useState<ToastState>(null);

  // --- Effects --- (Load/Save Logic remains the same)
   useEffect(() => {
    try {
      const savedAccounts = localStorage.getItem('tradingAccounts');
      const savedActiveId = localStorage.getItem('activeAccountId');
      let loadedAccounts: Account[] = [];
      if (savedAccounts) { loadedAccounts = JSON.parse(savedAccounts); }
      if (loadedAccounts.length === 0) {
        loadedAccounts = getDefaultAccounts();
        localStorage.setItem('tradingAccounts', JSON.stringify(loadedAccounts));
      }
      setAccounts(loadedAccounts);
      if (savedActiveId && loadedAccounts.some(acc => acc.id === savedActiveId)) {
        setActiveAccountId(savedActiveId);
      } else if (loadedAccounts.length > 0) {
        const firstAccountId = loadedAccounts[0].id;
        setActiveAccountId(firstAccountId);
        localStorage.setItem('activeAccountId', firstAccountId);
      } else {
        setActiveAccountId(null);
      }
    } catch (e) {
      console.error('Failed to load account data:', e);
      const defaultAccounts = getDefaultAccounts();
      setAccounts(defaultAccounts);
      if (defaultAccounts.length > 0) {
           const firstId = defaultAccounts[0].id;
           setActiveAccountId(firstId);
           localStorage.setItem('activeAccountId', firstId);
           localStorage.setItem('tradingAccounts', JSON.stringify(defaultAccounts));
      }
    }
  }, []);
  useEffect(() => {
    try {
        if (accounts.length > 0) { localStorage.setItem('tradingAccounts', JSON.stringify(accounts)); }
    } catch (e) { console.error('Failed to save accounts:', e); }
  }, [accounts]);
  useEffect(() => {
    try {
      if (activeAccountId) { localStorage.setItem('activeAccountId', activeAccountId); }
      else { localStorage.removeItem('activeAccountId'); }
    } catch (e) { console.error('Failed to save active account ID:', e); }
  }, [activeAccountId]);
  useEffect(() => {
    try {
      const v = localStorage.getItem('isDarkMode');
      if (v !== null) setIsDarkMode(v === 'true');
      else { setIsDarkMode(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true); }
    } catch (e) { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('isDarkMode', String(isDarkMode)); } catch (e) { /* ignore */ }
     document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // --- Account Management Functions ---

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  const navigateTo = useCallback((page: Page) => {
    setCurrentPage(page);
  }, []);

  const setActiveAccount = useCallback((id: string) => {
    if (accounts.some(acc => acc.id === id)) {
        setActiveAccountId(id);
        showToast(`Switched to account ${id}`, 'success');
    } else {
        console.error(`Attempted switch to non-existent account: ${id}`);
        showToast(`Could not find account ${id}`, 'error');
    }
  }, [accounts, showToast]);

  const openAccount = useCallback((type: 'live' | 'demo', currency: string, initialBalance?: number) => {
    if (type === 'demo') {
      const demoCount = accounts.filter(acc => acc.type === 'demo').length;
      if (demoCount >= 5) {
        showToast('Maximum number of demo accounts reached (5).', 'error');
        return { success: false, message: 'Maximum number of demo accounts reached (5).' };
      }
      if (initialBalance === undefined || initialBalance < 100 || initialBalance > 1000000) {
         showToast('Invalid starting balance for demo account.', 'error');
         return { success: false, message: 'Invalid starting balance.' };
      }
    }
    const newAccount: Account = {
      id: generateAccountId(type), type, currency,
      balances: { [currency]: type === 'demo' ? (initialBalance!) : 0 },
      createdAt: Date.now(),
    };
    setAccounts(prev => [...prev, newAccount]);
    showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} account ${newAccount.id} created.`, 'success');
    return { success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} account created successfully!` };
  }, [accounts, showToast]);

  const editDemoBalance = useCallback((accountId: string, newBalance: number) => {
     if (isNaN(newBalance) || newBalance < 100 || newBalance > 1000000) {
        showToast('Invalid balance amount provided.', 'error');
        return { success: false, message: 'Invalid balance amount.' };
    }
    let updated = false;
    setAccounts(prevAccounts =>
      prevAccounts.map(acc => {
        if (acc.id === accountId && acc.type === 'demo') {
           updated = true;
          return { ...acc, balances: { ...acc.balances, [acc.currency]: newBalance } };
        }
        return acc;
      })
    );
    if (updated) {
        showToast(`Demo account ${accountId} balance updated.`, 'success');
        return { success: true, message: 'Balance updated successfully!' };
    } else {
         showToast(`Could not find Demo account ${accountId} to update.`, 'error');
         return { success: false, message: 'Account not found or is not a Demo account.' };
    }
  }, [showToast]);

  // --- Trading Functions ---

  const activeAccount = useMemo(() => {
      return accounts.find(acc => acc.id === activeAccountId);
  }, [accounts, activeAccountId]);

  const handleDeposit = useCallback((amount: number) => {
    if (!activeAccount || amount <= 0) return;
    setAccounts(prevAccounts =>
      prevAccounts.map(acc => {
        if (acc.id === activeAccountId) {
          const currentBalance = acc.balances[acc.currency] ?? 0;
          return { ...acc, balances: { ...acc.balances, [acc.currency]: currentBalance + amount } };
        }
        return acc;
      })
    );
     showToast(`${formatBalance(amount, activeAccount.currency)} deposited to ${activeAccount.id}.`, 'success');
  }, [activeAccount, activeAccountId, showToast]);

  const handleBuyOrder = useCallback((symbol: string, amount: number, price: number): { success: boolean; message: string } => {
    if (!activeAccount) return { success: false, message: 'No active account selected.' };
    const totalCost = amount * price;
    const baseCurrency = symbol.replace(/USDT?$/, '');
    const quoteCurrency = activeAccount.currency;
    const currentQuoteBalance = activeAccount.balances[quoteCurrency] ?? 0;
    if (totalCost > currentQuoteBalance) {
      showToast('Insufficient funds to place buy order.', 'error');
      return { success: false, message: `Insufficient ${quoteCurrency} balance.` };
    }
    setAccounts(prevAccounts =>
      prevAccounts.map(acc => {
        if (acc.id === activeAccountId) {
          const currentBaseBalance = acc.balances[baseCurrency] ?? 0;
          return { ...acc, balances: { ...acc.balances, [quoteCurrency]: currentQuoteBalance - totalCost, [baseCurrency]: currentBaseBalance + amount } };
        }
        return acc;
      })
    );
     showToast(`Bought ${amount.toFixed(6)} ${baseCurrency} on ${activeAccount.id}.`, 'success');
    return { success: true, message: 'Buy order executed.' };
  }, [activeAccount, activeAccountId, showToast]);

  const handleSellOrder = useCallback((symbol: string, amount: number, price: number): { success: boolean; message: string } => {
    if (!activeAccount) return { success: false, message: 'No active account selected.' };
    const totalValue = amount * price;
    const baseCurrency = symbol.replace(/USDT?$/, '');
    const quoteCurrency = activeAccount.currency;
    const currentBaseBalance = activeAccount.balances[baseCurrency] ?? 0;
    if (amount > currentBaseBalance) {
      showToast(`Insufficient ${baseCurrency} to place sell order.`, 'error');
      return { success: false, message: `Insufficient ${baseCurrency} balance.` };
    }
    setAccounts(prevAccounts =>
      prevAccounts.map(acc => {
        if (acc.id === activeAccountId) {
          const currentQuoteBalance = acc.balances[quoteCurrency] ?? 0;
          return { ...acc, balances: { ...acc.balances, [quoteCurrency]: currentQuoteBalance + totalValue, [baseCurrency]: currentBaseBalance - amount } };
        }
        return acc;
      })
    );
     showToast(`Sold ${amount.toFixed(6)} ${baseCurrency} on ${activeAccount.id}.`, 'success');
    return { success: true, message: 'Sell order executed.' };
  }, [activeAccount, activeAccountId, showToast]);

  // --- Toolbar/Analytics Panel/Custom Interval ---
  const handleToolSelect = (toolId: string | null) => { setActiveTool(toolId); setShowAnalyticsPanel(toolId === 'alpha-vantage'); };
  const handleAnalyticsPanelClose = () => { setShowAnalyticsPanel(false); setActiveTool(null); };
  const handleCustomIntervalSubmit = () => { if (customInterval.trim()) { setActiveTimeframe(customInterval.trim()); setShowCustomInterval(false); setCustomInterval(''); } };

   // --- Derived State ---
   const activeUsdBalance = activeAccount?.balances[activeAccount.currency] ?? 0;
   const activeAccountCurrency = activeAccount?.currency ?? 'USD';
   const activeCryptoHoldings = useMemo(() => {
       if (!activeAccount) return {};
       return Object.entries(activeAccount.balances)
         .filter(([key]) => key !== activeAccount.currency)
         .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {} as Record<string, number>);
   }, [activeAccount]);

  // --- Render ---
  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <Header
          isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
          usdBalance={activeUsdBalance} accountCurrency={activeAccountCurrency}
          onDeposit={handleDeposit} navigateTo={navigateTo}
        />
        {currentPage === 'trading' && <LeftToolbar onToolSelect={handleToolSelect} activeTool={activeTool} />}
        {currentPage === 'trading' && <AnalyticsPanel isOpen={showAnalyticsPanel} onClose={handleAnalyticsPanelClose} symbol={activeInstrument} />}

        {/* Main Content Area */}
        {currentPage === 'trading' ? (
          // Trading Page Layout
           <div className="ml-14 px-4 py-4">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
               {/* Panels for Trading Page */}
               <div className="lg:col-span-2 space-y-4"> {/* Chart + OrderBook */}
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
                    {/* Timeframe */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                     <div className="flex items-center gap-2 md:gap-3">
                       <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400">Timeframe:</span>
                       {['1h', '4h', '1d'].map(tf => (<button key={tf} onClick={() => setActiveTimeframe(tf)} className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded transition ${activeTimeframe === tf? 'bg-indigo-600 text-white shadow-sm': 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{tf}</button>))}
                       {!showCustomInterval ? (<button onClick={() => setShowCustomInterval(true)} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-medium rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition border border-slate-300 dark:border-slate-700">Custom</button>) : (<div className="flex items-center gap-1 sm:gap-2"><input type="text" value={customInterval} onChange={(e) => setCustomInterval(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCustomIntervalSubmit()} placeholder="e.g., 15m" className="px-2 py-1 text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-16 sm:w-20" autoFocus /><button onClick={handleCustomIntervalSubmit} className="px-2 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 transition">OK</button><button onClick={() => { setShowCustomInterval(false); setCustomInterval(''); }} className="px-2 py-1 text-xs font-medium rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">X</button></div>)}
                     </div>
                     <div className="hidden sm:flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400"><button className="hover:text-slate-700 dark:hover:text-slate-200 transition opacity-50 cursor-not-allowed" title="Coming soon" disabled>Indicators</button><button className="hover:text-slate-700 dark:hover:text-slate-200 transition opacity-50 cursor-not-allowed" title="Coming soon" disabled>Compare</button></div>
                   </div>
                   <div className="mb-5"><LivePriceDisplay symbol={activeInstrument} /></div>
                   <div className="h-[480px] md:h-[520px] lg:h-[566px]"><ChartComponent timeframe={activeTimeframe} symbol={activeInstrument} /></div>
                 </div>
                 <div className="h-[300px] md:h-[360px] lg:h-[440px]"><OrderBookPanel activeInstrument={activeInstrument} /></div>
               </div>
               <div className="lg:col-span-1"><div className="h-full min-h-[800px] lg:min-h-[1000px] xl:min-h-[1100px]"><TradingPanel activeInstrument={activeInstrument} usdBalance={activeUsdBalance} cryptoHoldings={activeCryptoHoldings} onBuyOrder={handleBuyOrder} onSellOrder={handleSellOrder}/></div></div>
               <div className="lg:col-span-1 space-y-4">
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[500px] md:h-[600px] lg:h-[735px] overflow-y-auto"><InstrumentsPanel activeInstrument={activeInstrument} onInstrumentChange={setActiveInstrument}/></div>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 h-[400px] md:h-[450px] lg:h-[549px]"><NewsPanel /></div>
               </div>
             </div>
           </div>
        ) : (
          // Account Page - FIX: Remove navigateTo prop
          <AccountPage
            accounts={accounts} activeAccountId={activeAccountId}
            setActiveAccount={setActiveAccount} openAccount={openAccount}
            editDemoBalance={editDemoBalance}
            showToast={showToast} formatBalance={formatBalance}
            // navigateTo={navigateTo} // REMOVED
          />
        )}
        {toast && (<ToastNotification key={toast.id} message={toast.message} type={toast.type} onClose={() => setToast(null)}/>)}
      </div>
    </div>
  );
}