import { useMemo, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setActiveAccount } from '../store/slices/accountSlice';

interface AccountSwitcherProps {
  variant?: 'header' | 'wallet';
  className?: string;
}

export default function AccountSwitcher({ variant = 'header', className = '' }: AccountSwitcherProps) {
  const dispatch = useAppDispatch();
  const { accounts, activeAccountId } = useAppSelector(state => state.account);

  // Get active account
  const activeAccount = useMemo(() => 
    accounts.find(acc => acc.id === activeAccountId),
    [accounts, activeAccountId]
  );

  const activeAccountType = activeAccount?.type || 'live';

  // Separate accounts by type
  const liveAccounts = useMemo(() => 
    accounts.filter(acc => acc.type === 'live' && acc.status === 'active'),
    [accounts]
  );
  const demoAccounts = useMemo(() => 
    accounts.filter(acc => acc.type === 'demo' && acc.status === 'active'),
    [accounts]
  );

  // Switch to first account of the selected type
  const switchAccountType = (type: 'live' | 'demo') => {
    const accountsOfType = type === 'live' ? liveAccounts : demoAccounts;
    
    if (accountsOfType.length === 0) {
      // No accounts of this type available
      return;
    }

    // If current account is already of this type, keep it
    if (activeAccount?.type === type) {
      return;
    }

    // Switch to first account of the selected type
    const firstAccount = accountsOfType[0];
    dispatch(setActiveAccount(firstAccount.id));
  };

  // Ensure active account is valid on mount
  useEffect(() => {
    if (!activeAccount && accounts.length > 0) {
      // If no active account, default to first live account, or first demo if no live
      const firstAccount = liveAccounts[0] || demoAccounts[0];
      if (firstAccount) {
        dispatch(setActiveAccount(firstAccount.id));
      }
    }
  }, [activeAccount, accounts, liveAccounts, demoAccounts, dispatch]);

  // Determine if we should show the switcher (need at least one account of each type)
  const showSwitcher = liveAccounts.length > 0 && demoAccounts.length > 0;

  if (!showSwitcher) {
    // If only one type exists, show a badge indicating the type
    if (accounts.length > 0) {
      const onlyType = liveAccounts.length > 0 ? 'live' : 'demo';
      return (
        <div className={`flex items-center gap-2 ${className}`}>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            onlyType === 'live'
              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
              : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
          }`}>
            {onlyType === 'live' ? 'LIVE' : 'DEMO'}
          </span>
        </div>
      );
    }
    return null;
  }

  // Header variant - compact toggle buttons
  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <button
          onClick={() => switchAccountType('live')}
          className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeAccountType === 'live'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title="Switch to Live Account"
        >
          Live
          {activeAccountType === 'live' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full border-2 border-white dark:border-slate-900"></span>
          )}
        </button>
        <button
          onClick={() => switchAccountType('demo')}
          className={`relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeAccountType === 'demo'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title="Switch to Demo Account"
        >
          Demo
          {activeAccountType === 'demo' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full border-2 border-white dark:border-slate-900"></span>
          )}
        </button>
      </div>
    );
  }

  // Wallet variant - larger, more prominent
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Account Type:</span>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => switchAccountType('live')}
            className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeAccountType === 'live'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Live
            {activeAccountType === 'live' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-slate-800"></span>
            )}
          </button>
          <button
            onClick={() => switchAccountType('demo')}
            className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-all ${
              activeAccountType === 'demo'
                ? 'bg-green-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Demo
            {activeAccountType === 'demo' && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-slate-800"></span>
            )}
          </button>
        </div>
      </div>
      {/* Active account badge */}
      <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
        activeAccountType === 'live'
          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
          : 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
      }`}>
        {activeAccountType === 'live' ? 'LIVE' : 'DEMO'} ACTIVE
      </div>
    </div>
  );
}
