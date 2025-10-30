import type { Page } from '../App';

type MainSidebarProps = {
  currentPage: Page;
  navigateTo: (page: Page) => void;
};

// Icon component for navigation links
const NavIcon = ({ iconName }: { iconName: string }) => {
  const icons: Record<string, JSX.Element> = {
    account: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    // New Wallet Icon
    wallet: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    history: (
       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    trading: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
    )
  };
  return icons[iconName] || null;
};

// Navigation link component
type NavLinkProps = {
  icon: string;
  label: string;
  page: Page;
  currentPage: Page;
  navigateTo: (page: Page) => void;
  disabled?: boolean;
};

const NavLink = ({ icon, label, page, currentPage, navigateTo, disabled = false }: NavLinkProps) => {
  const isActive = currentPage === page;

  return (
    <button
      onClick={() => !disabled && navigateTo(page)}
      disabled={disabled}
      title={disabled ? `${label} (Coming soon)` : label}
      className={`flex flex-col items-center justify-center w-full h-20 transition-colors ${
        isActive
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
      } ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : ''
      }`}
    >
      <NavIcon iconName={icon} />
      <span className="text-xs font-medium mt-1">{label}</span>
    </button>
  );
};

export default function MainSidebar({ currentPage, navigateTo }: MainSidebarProps) {
  return (
    <nav className="fixed left-0 top-[60px] z-40 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-sm w-24 h-[calc(100vh-60px)]">
      {/* Navigation Links */}
      <div className="flex-1 flex flex-col items-center py-4 space-y-2">
        <NavLink
          icon="account"
          label="Account"
          page="account"
          currentPage={currentPage}
          navigateTo={navigateTo}
        />
        {/* Replaced Deposit/Withdraw with Wallet */}
        <NavLink
          icon="wallet"
          label="Wallet"
          page="wallet"
          currentPage={currentPage}
          navigateTo={navigateTo}
        />
        <NavLink
          icon="history"
          label="History"
          page="history"
          currentPage={currentPage}
          navigateTo={navigateTo}
          disabled={true}
        />
      </div>

      {/* Return to Trading Button */}
      <div className="py-4 border-t border-slate-200 dark:border-slate-700">
         <NavLink
          icon="trading"
          label="Trading"
          page="trading"
          currentPage={currentPage}
          navigateTo={navigateTo}
        />
      </div>
    </nav>
  );
}