import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import ProfileDropdown from './ProfileDropdown';
import NotificationBell from './NotificationBell';
import AccountSwitcher from './AccountSwitcher';
import { useAppDispatch, useAppSelector } from '../store';
import { setActiveWalletTab, toggleTheme } from '../store/slices/uiSlice';

// Icon component for navigation links
const NavIcon = ({ iconName }: { iconName: string }) => {
  const icons: Record<string, JSX.Element> = {
    account: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    wallet: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    history: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    trading: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  };
  return icons[iconName] || null;
};

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
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

  // Get active live account for header display
  const activeLiveAccount = useMemo(() => {
    if (!activeAccount || activeAccount.type !== 'live') return null;
    return activeAccount;
  }, [activeAccount]);

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

  // Navigation items
  const navItems = [
    { icon: 'account', label: 'Account', to: '/account' },
    { icon: 'trading', label: 'Trading', to: '/trading' },
    { icon: 'wallet', label: 'Wallet', to: '/wallet' },
    { icon: 'history', label: 'History', to: '/history' }
  ];

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-4 md:px-6 lg:px-8 py-2">
      <div className="flex items-center gap-2">
        {/* Left Side: Logo */}
        <div className="flex-shrink-0">
          <button
            onClick={() => navigate('/trading')}
            className="hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none"
          >
            <img
              src={isDarkMode ? "/new-02.png" : "/new-02.png"}
              alt="Hedgetechs"
              className="h-8 sm:h-10 lg:h-12"
            />
          </button>
        </div>

        {/* Navigation Links - Close to Logo */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 ml-4 lg:ml-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                    ? 'text-[#00C0A2] bg-[#00C0A2]/10 dark:bg-[#00C0A2]/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
              >
                <NavIcon iconName={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Icons and Actions */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 ml-auto mr-2 md:mr-4">
          {/* Account Switcher - Full on md+, compact badge on mobile */}
          <div className="hidden sm:block md:hidden">
            {/* Mobile: Show compact badge */}
            {activeAccount && (
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${activeAccount.type === 'live'
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                  : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                }`}>
                {activeAccount.type === 'live' ? 'LIVE' : 'DEMO'}
              </span>
            )}
          </div>
          <div className="hidden md:block">
            <AccountSwitcher variant="header" />
          </div>

          {/* Active Account Balance */}
          <div className="hidden sm:block text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <span className="hidden md:inline">Balance:{' '}</span>
            <span className="font-semibold">
              {usdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
              <span className="hidden sm:inline">{activeLiveAccount ? 'USD' : accountCurrency}</span>
            </span>
          </div>

          {/* Wallet Button */}
          <button
            onClick={() => {
              dispatch(setActiveWalletTab('deposit'));
              navigate('/wallet');
            }}
            className="text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg,rgb(0, 255, 217) 0%, #00C0A2 100%)',
              backgroundSize: '200% 100%',
              backgroundPosition: 'left',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderRadius: '8px',
              fontSize: '11px',
              transition: 'background-position 2s ease, transform 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundPosition = 'right';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundPosition = 'left';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Wallet
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Theme Toggle Button */}
          <button
            className="p-1.5 rounded-full text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 transition-all duration-200"
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
              className={`p-1.5 rounded-full transition-all duration-200 ${isProfileOpen
                  ? 'bg-[#00C0A2]/10 dark:bg-[#00C0A2]/20 text-[#00C0A2] dark:text-[#00C0A2]'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              title="Profile"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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