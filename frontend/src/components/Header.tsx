import { useState, useEffect, useRef } from 'react';
import ProfileDropdown from './ProfileDropdown';
import type { Page, WalletTab } from '../App';

type Props = {
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  usdBalance: number;
  accountCurrency: string;
  navigateTo: (page: Page, tab?: WalletTab) => void; // Updated type
  activeAccountId: string | null;
  activeAccountType: 'live' | 'demo' | undefined;
};

export default function Header({
  isDarkMode,
  setIsDarkMode,
  usdBalance,
  accountCurrency,
  navigateTo,
  activeAccountId,
  activeAccountType,
}: Props) {
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
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Brokerage Market Data</div>
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
            onClick={() => navigateTo('wallet', 'deposit')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-medium transition"
          >
            Funds
          </button>

          {/* Theme Toggle Button */}
          <button
            className="p-2 border border-slate-300 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
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
              navigateTo={navigateTo}
              closeDropdown={() => setIsProfileOpen(false)}
              activeAccountId={activeAccountId}
              activeAccountType={activeAccountType}
             />
          </div>
          
        </div>
      </div>
      
    </header>
  );
}