import { Link, useLocation } from 'react-router-dom';

// Icon component for mobile navigation
const MobileNavIcon = ({ iconName }: { iconName: string }) => {
  const icons: Record<string, JSX.Element> = {
  
    account: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
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

// Mobile navigation link component
type MobileNavLinkProps = {
  icon: string;
  label: string;
  to: string;
  isActive: boolean;
};

const MobileNavLink = ({ icon, label, to, isActive }: MobileNavLinkProps) => {
  return (
    <Link
      to={to}
      className={`flex-1 flex flex-col items-center justify-center h-16 transition-colors relative ${
        isActive
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400"></div>}
      <MobileNavIcon iconName={icon} />
      <span className="text-xs mt-1 font-medium">{label}</span>
    </Link>
  );
};

export default function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 h-16">
     
      <MobileNavLink
        icon="account"
        label="Account"
        to="/account"
        isActive={location.pathname === '/account'}
      />
      <MobileNavLink
        icon="trading"
        label="Trading"
        to="/trading"
        isActive={location.pathname === '/trading'}
      />
      <MobileNavLink
        icon="wallet"
        label="Wallet"
        to="/wallet"
        isActive={location.pathname === '/wallet'}
      />
      <MobileNavLink
        icon="history"
        label="History"
        to="/history"
        isActive={location.pathname === '/history'}
      />
    </nav>
  );
}
