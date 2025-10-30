// Define Page Type used for navigation
type Page = 'trading' | 'account';

type ProfileDropdownProps = {
  isOpen: boolean;
  navigateTo: (page: Page) => void; // Function to switch pages
  closeDropdown: () => void; // Function to close the dropdown
  // Props passed from Header
  activeAccountId: string | null;
  activeAccountType: 'live' | 'demo' | undefined;
};

// No longer need the hardcoded userData object

export default function ProfileDropdown({
  isOpen,
  navigateTo,
  closeDropdown,
  activeAccountId,
  activeAccountType,
}: ProfileDropdownProps) {
  if (!isOpen) return null;

  const handleLogOut = () => {
    closeDropdown(); // Close dropdown after action
    // In the future, this will handle user logout
  };

  const handleAccountClick = () => {
    navigateTo('account');
    closeDropdown(); // Close dropdown after navigation starts
  };

  // Prepare the dynamic data
  const accountId = activeAccountId || 'No Account';
  const accountTypeDisplay = activeAccountType
    ? `${activeAccountType.charAt(0).toUpperCase()}${activeAccountType.slice(1)} Account`
    : 'No Type';
  
  // Use the first letter of the account type for the avatar
  const avatarLetter = activeAccountType ? activeAccountType.charAt(0).toUpperCase() : '?';

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
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {accountTypeDisplay}
            </div>
          </div>
        </div>
        {/* Hardcoded verification status removed for accuracy */}
      </div>

      {/* Menu Items */}
      <div className="py-2">
        {/* Account Button */}
        <button
          onClick={handleAccountClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Account</span>
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