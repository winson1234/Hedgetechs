import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileDropdown from './ProfileDropdown';
import { useAppDispatch, useAppSelector } from '../store';
import { setActiveWalletTab, toggleTheme } from '../store/slices/uiSlice';

export default function Header() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Access Redux state
  const theme = useAppSelector(state => state.ui.theme);
  const { accounts, activeAccountId } = useAppSelector(state => state.account);

  // Derived state
  const isDarkMode = theme === 'dark';
  
  // Get active account and calculate USD balance
  const activeAccount = useMemo(() => 
    accounts.find(acc => acc.id === activeAccountId),
    [accounts, activeAccountId]
  );

  const usdBalance = useMemo(() => {
    if (!activeAccount || !activeAccount.balances) return 0;
    // Combine USD + USDT (treated as equivalent 1:1)
    const usdBal = activeAccount.balances.find(b => b.currency === 'USD')?.amount || 0;
    const usdtBal = activeAccount.balances.find(b => b.currency === 'USDT')?.amount || 0;
    return usdBal + usdtBal;
  }, [activeAccount]);

  const accountCurrency = activeAccount?.currency || 'USD';

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // --- Click outside handler for dropdown ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left Side: Title */}
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none"
          >
             <img 
              src={isDarkMode ? "/Hedgetech logo dark mode.png" : "/hedgetech logo-02.png"} 
              alt="Hedgetechs" 
              className="h-12" 
            />
          </button>
        </div>

        {/* Right Side: Icons and Actions */}
        <div className="flex items-center gap-4">
          {/* Active Account Balance */}
          <div className="text-sm text-slate-700 dark:text-slate-300">
            Balance:{' '}
            <span className="font-semibold">
              {usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              {accountCurrency}
            </span>
          </div>
          
          {/* Updated "Deposit" to "Funds" and changed onClick */}
          <button
            onClick={() => {
              dispatch(setActiveWalletTab('deposit'));
              navigate('/wallet');
            }}
            className="bg-[#00C0A2] hover:bg-[#00a085] text-white px-4 py-1.5 rounded text-sm font-medium transition"
          >
            Funds
          </button>

          {/* Theme Toggle Button */}
          <button
            className="p-2 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            onClick={() => dispatch(toggleTheme())}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Z" />
              </svg>
            )}
          </button>

          {/* User Profile Button with CLICK Dropdown */}
          <div
            className="relative"
            ref={profileRef}
          >
            <button
              onClick={() => setIsProfileOpen(prev => !prev)}
              className={`p-2 border rounded transition ${
                isProfileOpen
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Profile"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>

            {/* Profile Dropdown */}
            <ProfileDropdown
              isOpen={isProfileOpen}
              closeDropdown={() => setIsProfileOpen(false)}
             />
          </div>
          
        </div>
      </div>
      
    </header>
  );
}