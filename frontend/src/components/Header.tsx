import { useState, useEffect, useRef } from 'react';
import ProfileDropdown from './ProfileDropdown';

// Define Page Type used for navigation
type Page = 'trading' | 'account';

type Props = {
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  usdBalance: number; // Balance of the active account
  accountCurrency: string; // Currency of the active account
  onDeposit: (amount: number) => void;
  navigateTo: (page: Page) => void; // Function to switch pages
  // Add the new props here
  activeAccountId: string | null;
  activeAccountType: 'live' | 'demo' | undefined;
};

export default function Header({
  isDarkMode,
  setIsDarkMode,
  usdBalance,
  accountCurrency,
  onDeposit,
  navigateTo,
  activeAccountId,
  activeAccountType,
}: Props) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const profileRef = useRef<HTMLDivElement>(null); // Ref for the dropdown container

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid deposit amount entered.');
      return;
    }
    onDeposit(amount);
    setDepositAmount('');
    setShowDepositModal(false);
  };

  // --- Click outside handler for dropdown ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click is outside the profile dropdown container (profileRef)
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false); // Close the dropdown
      }
    };

    // Add event listener when the dropdown is open
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      // Remove event listener when dropdown is closed
      document.removeEventListener('mousedown', handleClickOutside);
    }

    // Cleanup listener on component unmount or when isProfileOpen changes
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]); // Re-run effect when isProfileOpen changes

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
          {/* Deposit Button */}
          <button
            onClick={() => setShowDepositModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-sm font-medium transition"
          >
            Deposit
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

          <div className="flex items-center gap-2">
             {/* Trading Page Navigation Button */}
             <button
              onClick={() => navigateTo('trading')}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Go to Trading"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11h16v2H2v-2z"/>
                <path fillRule="evenodd" d="M4 4a1 1 0 011-1h1V2a1 1 0 112 0v1h1V2a1 1 0 112 0v1h1V2a1 1 0 112 0v1h1a1 1 0 011 1v5H4V4zm0 1v3h12V5H5a1 1 0 00-1 1z" clipRule="evenodd"/>
                <path d="M2 15h1v2H2v-2zm2 0h1v2H4v-2zm2 0h1v2H6v-2zm2 0h1v2H8v-2zm2 0h1v2h-1v-2zm2 0h1v2h-1v-2zm2 0h1v2h-1v-2zm2 0h1v2h-1v-2z"/>
              </svg>
            </button>

            {/* Grid/Menu Button - Placeholder */}
            <button
              className="p-2 border border-slate-300 dark:border-slate-700 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition opacity-50 cursor-not-allowed"
              title="Menu (Coming soon)"
              disabled
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="5" r="2" /> <circle cx="12" cy="5" r="2" /> <circle cx="19" cy="5" r="2" />
                <circle cx="5" cy="12" r="2" /> <circle cx="12" cy="12" r="2" /> <circle cx="19" cy="12" r="2" />
                <circle cx="5" cy="19" r="2" /> <circle cx="12" cy="19" r="2" /> <circle cx="19" cy="19" r="2" />
              </svg>
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

              {/* Profile Dropdown - Pass new props down */}
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
      </div>

      {/* Deposit Modal (no changes needed here) */}
      {showDepositModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowDepositModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Deposit Funds ({accountCurrency})</h2>
              <button
                onClick={() => setShowDepositModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Amount ({accountCurrency})
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDeposit()}
                  placeholder="0.00"
                  min="0" step="any"
                  className="w-full px-4 py-2 text-lg border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                {[100, 500, 1000, 5000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setDepositAmount(String(amount))}
                    className="flex-1 px-3 py-2 text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  >
                   {accountCurrency === 'USD' ? '$' : ''}{amount}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeposit}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition"
                >
                  Confirm Deposit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}