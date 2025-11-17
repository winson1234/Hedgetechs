import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { setSidebarExpanded } from '../store/slices/uiSlice';

// Icon component for navigation links
const NavIcon = ({ iconName }: { iconName: string }) => {
  const icons: Record<string, JSX.Element> = {
    dashboard: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
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
    ),
    chevronRight: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    ),
    chevronLeft: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    )
  };
  return icons[iconName] || null;
};

// Navigation link component
type NavLinkProps = {
  icon: string;
  label: string;
  to: string;
  isActive: boolean;
  isExpanded: boolean;
  disabled?: boolean;
};

const NavLink = ({ icon, label, to, isActive, isExpanded, disabled = false }: NavLinkProps) => {
  if (disabled) {
    return (
      <div
        title={`${label} (Coming soon)`}
        className={`flex items-center w-full transition-colors opacity-50 cursor-not-allowed text-slate-500 dark:text-slate-400 ${
          isExpanded ? 'h-12 px-4' : 'h-14 justify-center'
        }`}
      >
        <div className="flex-shrink-0">
          <NavIcon iconName={icon} />
        </div>
        {isExpanded && <span className="ml-3 text-sm font-medium">{label}</span>}
      </div>
    );
  }

  return (
    <Link
      to={to}
      title={!isExpanded ? label : undefined}
      className={`flex items-center w-full transition-colors relative ${
        isExpanded ? 'h-12 px-4' : 'h-14 justify-center'
      } ${
        isActive
          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
      }`}
    >
      {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 dark:bg-indigo-400"></div>}
      <div className="flex-shrink-0">
        <NavIcon iconName={icon} />
      </div>
      {isExpanded && <span className="ml-3 text-sm font-medium whitespace-nowrap">{label}</span>}
    </Link>
  );
};

export default function MainSidebar() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const isSidebarExpanded = useAppSelector(state => state.ui.isSidebarExpanded);
  const [isHovered, setIsHovered] = useState(false);

  // Determine if sidebar should be shown as expanded
  const showExpanded = isSidebarExpanded || isHovered;

  // Handle toggle
  const handleToggle = () => {
    dispatch(setSidebarExpanded(!isSidebarExpanded));
  };

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+B (Windows/Linux) or Cmd+B (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        dispatch(setSidebarExpanded(!isSidebarExpanded));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarExpanded, dispatch]);

  return (
    <nav
      onMouseEnter={() => !isSidebarExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed left-0 top-[60px] bottom-0 z-40 hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-150 ease-in-out ${
        showExpanded ? 'w-44' : 'w-14'
      } ${!isSidebarExpanded && isHovered ? 'shadow-lg' : 'shadow-sm'}`}
    >
      {/* Navigation Links */}
      <div className="flex-1 flex flex-col py-4">
        <NavLink
          icon="dashboard"
          label="Dashboard"
          to="/dashboard"
          isActive={location.pathname === '/' || location.pathname === '/dashboard'}
          isExpanded={showExpanded}
        />
        <NavLink
          icon="account"
          label="Account"
          to="/account"
          isActive={location.pathname === '/account'}
          isExpanded={showExpanded}
        />
        <NavLink
          icon="trading"
          label="Trading"
          to="/trading"
          isActive={location.pathname === '/trading'}
          isExpanded={showExpanded}
        />
        <NavLink
          icon="wallet"
          label="Wallet"
          to="/wallet"
          isActive={location.pathname === '/wallet'}
          isExpanded={showExpanded}
        />
        <NavLink
          icon="history"
          label="History"
          to="/history"
          isActive={location.pathname === '/history'}
          isExpanded={showExpanded}
        />
      </div>

      {/* Toggle Button */}
      <div className="border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={handleToggle}
          title={isSidebarExpanded ? 'Collapse sidebar (Ctrl+B)' : 'Expand sidebar (Ctrl+B)'}
          className={`flex items-center w-full transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50 ${
            showExpanded ? 'h-12 px-4' : 'h-14 justify-center'
          }`}
        >
          <div className="flex-shrink-0">
            <NavIcon iconName={isSidebarExpanded ? 'chevronLeft' : 'chevronRight'} />
          </div>
          {showExpanded && <span className="ml-3 text-sm font-medium whitespace-nowrap">Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
