import { useAccountStore } from '../stores/accountStore';

type ProfileDropdownProps = {
  isOpen: boolean;
  closeDropdown: () => void;
};

export default function ProfileDropdown({
  isOpen,
  closeDropdown,
}: ProfileDropdownProps) {
  // Access stores
  const activeAccountId = useAccountStore(state => state.activeAccountId);
  const getActiveAccount = useAccountStore(state => state.getActiveAccount);

  const activeAccount = getActiveAccount();
  const activeAccountType = activeAccount?.type;
  if (!isOpen) return null;

  const handleLogOut = () => {
    // 1. Clear auth key
    localStorage.removeItem('loggedInUser');

    // 2. Clear all Zustand persisted stores
    localStorage.removeItem('account-store');
    localStorage.removeItem('order-store');
    localStorage.removeItem('transaction-storage');
    localStorage.removeItem('ui-store');

    // 3. Clear FX rate cache
    localStorage.removeItem('fx_rates_cache');
    localStorage.removeItem('fx_rates_cache_time');

    // 4. Close dropdown and redirect to dashboard
    closeDropdown();
    window.location.href = '/dashboard.html';
  };

  const handleProfileClick = () => {
    closeDropdown();
    window.location.href = '/profile.html';
  };

  const handleSettingsClick = () => {
    closeDropdown();
    window.location.href = '/securitySettings.html';
  };

  const accountId = activeAccountId || 'No Account';
  const avatarLetter = activeAccountType ? activeAccountType.charAt(0).toUpperCase() : '?';

  // Create a renderable element for the account type badge
  const accountTypeDisplay = () => {
    if (activeAccountType === 'live') {
      return (
        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
          Live Account
        </span>
      );
    }
    if (activeAccountType === 'demo') {
      return (
        <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
          Demo Account
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        No Active Account
      </span>
    );
  };

  return (
    <div
      className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50"
    >
      {/* User Info Section */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {accountId}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {accountTypeDisplay()}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        {/* Profile Button */}
        <button
          onClick={handleProfileClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Profile</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={handleSettingsClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </button>

        {/* Log Out Button */}
        <button
          onClick={handleLogOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}