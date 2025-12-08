import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../../store';
import { signOut } from '../../../store/slices/authSlice';
import { clearAccounts } from '../../../store/slices/accountSlice';
import { clearOrders } from '../../../store/slices/orderSlice';
import { PRIMARY_NAV_ITEMS, LANGUAGES } from '../constants/dashboard';
import LogoutModal from './LogoutModal';

interface HeaderProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  activeSectionId: string;
  scrollToSection: (index: number) => void;
}

const Header: React.FC<HeaderProps> = ({ 
  isDarkMode, 
  toggleTheme, 
  activeSectionId,
  scrollToSection 
}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const isLoggedIn = useAppSelector(state => !!state.auth.token);
  const user = useAppSelector(state => state.auth.user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('EN-UK');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Reorder languages so selected is first
  const sortedLanguages = [
    ...LANGUAGES.filter(lang => lang.code === selectedLanguage),
    ...LANGUAGES.filter(lang => lang.code !== selectedLanguage)
  ];

  const handleNavClick = (event: React.MouseEvent, id: string) => {
    event.preventDefault();
    const element = document.getElementById(id);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth" });
  };

  const handleMobileNavClick = (event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    event.preventDefault();
    const sectionIndex = PRIMARY_NAV_ITEMS.findIndex(item => item.id === sectionId);
    if (sectionIndex !== -1) {
      scrollToSection(sectionIndex);
    }
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
    setProfileDropdownOpen(false);
  };

  const confirmLogout = async () => {
    await dispatch(signOut());
    dispatch(clearAccounts());
    dispatch(clearOrders());
    setShowLogoutModal(false);
    window.location.href = '/';
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  // Intersection Observer for header background
  useEffect(() => {
    const header = document.querySelector("header.header");
    const homeSection = document.querySelector<HTMLElement>("#home");

    if (!header || !homeSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          header.classList.remove("scrolled");
        } else {
          header.classList.add("scrolled");
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(homeSection);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header className="header" data-scroll>
        <div className="container">
          <div className="nav-wrapper">
            {/* Logo */}
            <div className="logo">
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  const section = document.querySelector("#home");
                  section?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <img 
                  key={isDarkMode ? 'dark' : 'light'} // ✅ Forces re-render with animation
                  src={isDarkMode ? "/new-02.png" : "/new-02.png"} 
                  alt="Hedgetechs.co" 
                  className="logo-image" 
                />
              </a>
            </div>

            {/* Desktop Nav */}
            <nav className="nav-menu">
              {PRIMARY_NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`nav-link ${activeSectionId === item.id ? 'active' : ''}`}
                  onClick={(event) => handleNavClick(event, item.id)}
                  aria-current={activeSectionId === item.id ? 'page' : undefined}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Right Side Actions */}
            <div className="nav-actions">
              {/* Theme Toggle */}
              <button className="icon-btn" id="themeToggle" onClick={toggleTheme} title="Toggle Theme">
                {isDarkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1a1f3a" stroke="#1a1f3a" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
              
              {/* Language Selector */}
              <div className="language-selector">
                <button
                  className="icon-btn"
                  onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                  title="Select Language"
                >
                  {LANGUAGES.map(lang =>
                    selectedLanguage === lang.code ? (
                      <img key={lang.code} src={lang.flag} alt={lang.name} width="20" height="15" />
                    ) : null
                  )}
                </button>

                {languageMenuOpen && (
                  <ul className="language-menu show">
                    {sortedLanguages.map(lang => (
                      <li
                        key={lang.code}
                        className={selectedLanguage === lang.code ? 'selected' : ''}
                        onClick={() => {
                          setSelectedLanguage(lang.code);
                          setLanguageMenuOpen(false);
                        }}
                      >
                        <img src={lang.flag} alt={lang.name} width="20" height="15" /> {lang.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Auth Buttons / Profile */}
              {!isLoggedIn ? (
                <div id="guestButtons">
                  <Link to="/login" className="btn btn-secondary">Log In</Link>
                  <Link to="/register" className="btn btn-gradient">Sign Up</Link>
                </div>
              ) : (
                <div className="profile-container">
                  <div className="profile-icon" onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}>
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  {profileDropdownOpen && (
                    <div className="profile-dropdown show">
                      <div className="dropdown-header">
                        <div className="dropdown-username">{user?.email?.split('@')[0] || 'User'}</div>
                        <div className="dropdown-email">{user?.email || 'user@example.com'}</div>
                      </div>
                      <div className="dropdown-menu">
                        <Link to="/profile" className="dropdown-item">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                          </svg>
                          Profile
                        </Link>
                        <Link to="/account" className="dropdown-item">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                          </svg>
                          Accounts
                        </Link>
                        <Link to="/settings/security" className="dropdown-item">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          Settings
                        </Link>
                        <div className="dropdown-divider"></div>
                        <button onClick={handleLogout} className="dropdown-item">
                          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                          </svg>
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Menu Button */}
              <button className="mobile-menu-btn" id="mobileMenuBtn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                <svg className="menu-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: mobileMenuOpen ? 'none' : 'block' }}>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                <svg className="close-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: mobileMenuOpen ? 'block' : 'none' }}>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mobile-menu">
            <nav className="mobile-nav">
              {PRIMARY_NAV_ITEMS.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`mobile-nav-link ${activeSectionId === item.id ? 'active' : ''}`}
                  onClick={(event) => handleMobileNavClick(event, item.id)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Logout Modal */}
      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
      />
    </>
  );
};

export default Header;