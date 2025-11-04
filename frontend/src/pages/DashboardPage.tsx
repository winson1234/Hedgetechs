import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import './dashboard.css';

export default function DashboardPage() {
  const { isLoggedIn, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeMarketTab, setActiveMarketTab] = useState('popular');
  const [activeNewsTab, setActiveNewsTab] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('EN');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
    setProfileDropdownOpen(false);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate('/login');
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  useEffect(() => {
    document.body.className = theme === 'dark' ? 'dark-mode' : 'light-mode';
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const cryptoData = [
    { symbol: 'BTC', name: 'Bitcoin', price: 53380.20, change: 2.3, filter: 'popular', icon: '₿', gradient: 'linear-gradient(135deg, #f7931a, #ff9500)' },
    { symbol: 'ETH', name: 'Ethereum', price: 1543.80, change: 1.1, filter: 'popular', icon: 'Ξ', gradient: 'linear-gradient(135deg, #627eea, #8a9cff)' },
    { symbol: 'BNB', name: 'Binance Coin', price: 247.77, change: 2.4, filter: 'popular', icon: 'B', gradient: 'linear-gradient(135deg, #f3ba2f, #ffd700)' },
    { symbol: 'SOL', name: 'Solana', price: 152.93, change: -1.2, filter: 'popular', icon: '◎', gradient: 'linear-gradient(135deg, #9945ff, #14f195)' },
    { symbol: 'ADA', name: 'Cardano', price: 0.389, change: 3.5, filter: 'popular', icon: '₳', gradient: 'linear-gradient(135deg, #0033ad, #3468d6)' },
    { symbol: 'XRP', name: 'Ripple', price: 0.5627, change: 3.9, filter: 'popular', icon: '✕', gradient: 'linear-gradient(135deg, #23292f, #3d4853)' },
    { symbol: 'USDT', name: 'Tether', price: 0.9989, change: -0.01, filter: 'popular', icon: '₮', gradient: 'linear-gradient(135deg, #26a17b, #50af95)' },
  ];

  const newsItems = [
    {
      id: 1,
      title: 'Bitcoin Surges Past $54K as Institutional Adoption Accelerates',
      excerpt: 'Major financial institutions continue to embrace cryptocurrency as Bitcoin reaches new quarterly highs amid growing market confidence.',
      source: 'CoinDesk',
      category: 'crypto',
      timestamp: '2 hours ago',
      featured: true,
      image: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80'
    },
    {
      id: 2,
      title: 'Ethereum ETF Approval Expected to Drive Market Growth',
      excerpt: 'Analysts predict significant market impact following anticipated regulatory approval for spot Ethereum ETFs.',
      source: 'Bloomberg',
      category: 'markets',
      timestamp: '4 hours ago',
      featured: false
    },
    {
      id: 3,
      title: 'DeFi Protocol Launches Revolutionary Yield Strategy',
      excerpt: 'New decentralized finance platform introduces innovative approach to maximizing returns while minimizing risk.',
      source: 'The Block',
      category: 'crypto',
      timestamp: '5 hours ago',
      featured: false
    },
    {
      id: 4,
      title: 'SEC Announces New Framework for Digital Asset Regulation',
      excerpt: 'Regulatory body unveils comprehensive guidelines aimed at providing clarity for cryptocurrency market participants.',
      source: 'Reuters',
      category: 'regulation',
      timestamp: '6 hours ago',
      featured: false
    },
    {
      id: 5,
      title: 'Layer 2 Solutions Show 300% Growth in Transaction Volume',
      excerpt: 'Scaling solutions continue to gain traction as users seek lower fees and faster transaction speeds on blockchain networks.',
      source: 'CryptoSlate',
      category: 'technology',
      timestamp: '8 hours ago',
      featured: false
    },
    {
      id: 6,
      title: 'Major Exchange Launches Zero-Fee Trading for Select Pairs',
      excerpt: 'Leading cryptocurrency platform introduces competitive pricing structure to attract new traders and increase market liquidity.',
      source: 'Decrypt',
      category: 'crypto',
      timestamp: '10 hours ago',
      featured: false
    },
  ];

  const faqItems = [
    {
      question: 'How do I verify my identity (KYC)?',
      answer: 'Go to Account Settings → Verification, and upload your ID (passport or national ID) along with a selfie. Once submitted, our system will process it within 24–48 hours. You\'ll receive an email once your verification is approved or if additional documents are required.'
    },
    {
      question: 'How do I deposit funds into my account?',
      answer: 'To deposit, go to Wallet → Deposit, select your preferred currency and payment method, then follow the on-screen instructions. Supported methods include bank transfer, credit/debit card, and crypto deposits. Deposits are typically processed instantly, depending on your payment provider.'
    },
    {
      question: 'How do I place a trade?',
      answer: 'Navigate to the Trading Page, select your desired instrument (e.g., BTC/USD), and choose between Market or Limit Order. Enter your trade size, set optional Take Profit and Stop Loss levels, then confirm the order. Once executed, you can monitor open positions from your Positions tab.'
    },
    {
      question: 'Can I transfer funds between my trading accounts?',
      answer: 'Yes. Go to Wallet → Transfer, choose the source and destination accounts (e.g., Main → Trading), specify the amount, and confirm. Transfers between internal wallets are instant and free of charge.'
    },
    {
      question: 'How can I contact customer support?',
      answer: 'You can reach our support team via Live Chat or Email at support@fpmarkets.com. Our team is available 24/7 to assist with any account, trading, or technical inquiries.'
    },
  ];

  const filteredCrypto = activeMarketTab === 'popular'
    ? cryptoData.filter(c => c.filter === 'popular')
    : activeMarketTab === 'gainers'
    ? cryptoData.filter(c => c.change > 0)
    : activeMarketTab === 'losers'
    ? cryptoData.filter(c => c.change < 0)
    : cryptoData;

  const filteredNews = activeNewsTab === 'all'
    ? newsItems
    : newsItems.filter(n => n.category === activeNewsTab);

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="nav-wrapper">
            <div className="logo">
              <Link to="/">
                <span className="logo-text">FP<span className="logo-accent">Markets</span></span>
              </Link>
            </div>

            {/* Desktop Nav */}
            <nav className="nav-menu">
              <a href="#market" className="nav-link">Markets</a>
              <a href="#news" className="nav-link">News</a>
              <a href="#features" className="nav-link">Features</a>
              <a href="#about" className="nav-link">About</a>
              <a href="#faq" className="nav-link">FAQ</a>
            </nav>

            {/* Right Side Actions */}
            <div className="nav-actions">
              {/* Theme Toggle */}
              <button className="icon-btn" id="themeToggle" onClick={toggleTheme} title="Toggle Theme">
                <svg className="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                <svg className="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              </button>

              {/* Language Selector */}
              <div className="language-selector">
                <button className="icon-btn" id="languageToggle" onClick={() => setLanguageMenuOpen(!languageMenuOpen)} title="Select Language">
                  <span id="languageLabel">{selectedLanguage}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {languageMenuOpen && (
                  <ul className="language-menu show">
                    <li onClick={() => { setSelectedLanguage('EN'); setLanguageMenuOpen(false); }}>🇬🇧 English</li>
                    <li onClick={() => { setSelectedLanguage('CN'); setLanguageMenuOpen(false); }}>🇨🇳 中文</li>
                    <li onClick={() => { setSelectedLanguage('JP'); setLanguageMenuOpen(false); }}>🇯🇵 日本語</li>
                    <li onClick={() => { setSelectedLanguage('KR'); setLanguageMenuOpen(false); }}>🇰🇷 한국어</li>
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
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  {profileDropdownOpen && (
                    <div className="profile-dropdown show">
                      <div className="dropdown-header">
                        <div className="dropdown-username">{user?.name || 'User'}</div>
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
              <a href="#market" className="mobile-nav-link">Markets</a>
              <a href="#news" className="mobile-nav-link">News</a>
              <a href="#features" className="mobile-nav-link">Features</a>
              <a href="#about" className="mobile-nav-link">About</a>
              <a href="#faq" className="mobile-nav-link">FAQ</a>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="hero" id="home">
        <div className="container hero-container">
          <div className="hero-content">
            {/* Trust Badge */}
            <div className="hero-badge">
              <span className="badge-icon">✓</span>
              Trusted by 20M+ traders worldwide
            </div>

            {/* Main Heading */}
            <h1 className="hero-title">A trusted and secure<br />cryptocurrency exchange.</h1>

            {/* Subtitle */}
            <p className="hero-subtitle">
              Your guide to the world of an open financial system. Get started with the easiest and most secure platform to buy and trade cryptocurrency.
            </p>

            {/* CTA Section */}
            <div className="hero-cta">
              <input type="email" className="email-input" placeholder="Enter your email address" />
              <button className="btn btn-gradient btn-large">Get Started</button>
            </div>

            {/* Trust Badges */}
            <div className="trust-badges">
              <div className="trust-item">
                <div className="trust-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </div>
                <div className="trust-text">
                  <span className="trust-label">Security</span>
                  <span className="trust-value">Bank-Level</span>
                </div>
              </div>

              <div className="trust-item">
                <div className="trust-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div className="trust-text">
                  <span className="trust-label">Trading</span>
                  <span className="trust-value">24/7</span>
                </div>
              </div>

              <div className="trust-item">
                <div className="trust-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <line x1="23" y1="21" x2="23" y2="15"></line>
                    <line x1="17" y1="18" x2="23" y2="18"></line>
                  </svg>
                </div>
                <div className="trust-text">
                  <span className="trust-label">Support</span>
                  <span className="trust-value">Expert</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Image */}
          <div className="hero-image">
            <img src="/assets/images/crypto-hero.png" alt="Cryptocurrency Illustration" className="hero-img" />

            {/* Floating Crypto Cards */}
            <div className="floating-cards">
              <div className="floating-card card-1">
                <div className="crypto-mini">
                  <div className="crypto-icon-mini" style={{ background: 'linear-gradient(135deg, #f7931a, #ff9500)' }}>₿</div>
                  <div className="crypto-info-mini">
                    <div className="crypto-symbol-mini">BTC</div>
                    <div className="crypto-price-mini positive">+2.4%</div>
                  </div>
                </div>
              </div>

              <div className="floating-card card-2">
                <div className="crypto-mini">
                  <div className="crypto-icon-mini" style={{ background: 'linear-gradient(135deg, #627eea, #8a9cff)' }}>Ξ</div>
                  <div className="crypto-info-mini">
                    <div className="crypto-symbol-mini">ETH</div>
                    <div className="crypto-price-mini positive">+1.8%</div>
                  </div>
                </div>
              </div>

              <div className="floating-card card-3">
                <div className="crypto-mini">
                  <div className="crypto-icon-mini" style={{ background: 'linear-gradient(135deg, #f3ba2f, #ffd700)' }}>B</div>
                  <div className="crypto-info-mini">
                    <div className="crypto-symbol-mini">BNB</div>
                    <div className="crypto-price-mini positive">+3.2%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Banner */}
        <div className="container">
          <div className="stats-banner">
            <div className="stat-item">
              <div className="stat-value">$2.5B+</div>
              <div className="stat-label">24h Trading Volume</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">20M+</div>
              <div className="stat-label">Active Traders</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">198+</div>
              <div className="stat-label">Countries</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">350+</div>
              <div className="stat-label">Trading Pairs</div>
            </div>
          </div>
        </div>
      </section>

      {/* Market Overview */}
      <section className="market-section" id="market">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Today&apos;s Cryptocurrency Prices</h2>
            <p className="section-subtitle">
              The global crypto market cap is <span className="market-cap-value">$2.89T</span> with 24h volume of <span className="market-volume-value">$120B</span>
            </p>
          </div>

          {/* Market Tabs */}
          <div className="market-tabs">
            <button className={`market-tab ${activeMarketTab === 'popular' ? 'active' : ''}`} onClick={() => setActiveMarketTab('popular')}>
              <span className="tab-icon">🔥</span>
              Popular Coins
            </button>
            <button className={`market-tab ${activeMarketTab === 'new' ? 'active' : ''}`} onClick={() => setActiveMarketTab('new')}>
              <span className="tab-icon">✨</span>
              New Listings
            </button>
            <button className={`market-tab ${activeMarketTab === 'gainers' ? 'active' : ''}`} onClick={() => setActiveMarketTab('gainers')}>
              <span className="tab-icon">📈</span>
              Top Gainers
            </button>
            <button className={`market-tab ${activeMarketTab === 'losers' ? 'active' : ''}`} onClick={() => setActiveMarketTab('losers')}>
              <span className="tab-icon">📉</span>
              Top Losers
            </button>
          </div>

          <div className="crypto-table">
            <div className="crypto-row crypto-header">
              <div className="crypto-col">Asset</div>
              <div className="crypto-col">Last Price</div>
              <div className="crypto-col">24h Change</div>
              <div className="crypto-col">Chart</div>
              <div className="crypto-col">Trade</div>
            </div>

            {filteredCrypto.map(crypto => (
              <div key={crypto.symbol} className="crypto-row">
                <div className="crypto-col">
                  <div className="crypto-info">
                    <div className="crypto-icon" style={{ background: crypto.gradient }}>{crypto.icon}</div>
                    <div>
                      <div className="crypto-symbol">{crypto.symbol}</div>
                      <div className="crypto-name">{crypto.name}</div>
                    </div>
                  </div>
                </div>
                <div className="crypto-col crypto-price">${crypto.price.toLocaleString()}</div>
                <div className={`crypto-col crypto-change ${crypto.change > 0 ? 'positive' : 'negative'}`}>
                  <span className="change-arrow">{crypto.change > 0 ? '▲' : '▼'}</span> {crypto.change > 0 ? '+' : ''}{crypto.change}%
                </div>
                <div className="crypto-col">
                  <div className={`mini-chart ${crypto.change > 0 ? 'positive' : 'negative'}`}></div>
                </div>
                <div className="crypto-col">
                  <button className="btn-trade">Buy</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="news-section" id="news">
        <div className="container">
          {/* Section Header */}
          <div className="section-header">
            <div className="header-left">
              <h2 className="section-title">Latest Market News</h2>
              <p className="section-subtitle">Stay updated with real-time crypto and financial headlines</p>
            </div>
            <div className="header-right">
              <a href="#" className="btn btn-secondary view-all-btn">
                View All News
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </a>
            </div>
          </div>

          {/* News Filter Tabs */}
          <div className="news-tabs">
            <button className={`news-tab ${activeNewsTab === 'all' ? 'active' : ''}`} onClick={() => setActiveNewsTab('all')}>
              <span className="tab-icon">📰</span>
              All News
            </button>
            <button className={`news-tab ${activeNewsTab === 'crypto' ? 'active' : ''}`} onClick={() => setActiveNewsTab('crypto')}>
              <span className="tab-icon">₿</span>
              Crypto
            </button>
            <button className={`news-tab ${activeNewsTab === 'markets' ? 'active' : ''}`} onClick={() => setActiveNewsTab('markets')}>
              <span className="tab-icon">📈</span>
              Markets
            </button>
            <button className={`news-tab ${activeNewsTab === 'technology' ? 'active' : ''}`} onClick={() => setActiveNewsTab('technology')}>
              <span className="tab-icon">💻</span>
              Technology
            </button>
            <button className={`news-tab ${activeNewsTab === 'regulation' ? 'active' : ''}`} onClick={() => setActiveNewsTab('regulation')}>
              <span className="tab-icon">⚖️</span>
              Regulation
            </button>
          </div>

          {/* News Grid */}
          <div className="news-grid">
            {filteredNews.map(news => (
              <div key={news.id} className={`news-item ${news.featured ? 'featured' : ''}`}>
                {news.featured && (
                  <div className="news-badge featured-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    Featured
                  </div>
                )}
                {!news.featured && (
                  <div className="news-badge">{news.category.charAt(0).toUpperCase() + news.category.slice(1)}</div>
                )}
                {news.image && (
                  <div className="news-image">
                    <img src={news.image} alt={news.title} loading="lazy" />
                    <div className="news-overlay"></div>
                  </div>
                )}
                <div className="news-content">
                  <div className="news-meta">
                    <span className="news-source">{news.source}</span>
                    <span className="news-time">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      {news.timestamp}
                    </span>
                  </div>
                  <h3 className="news-title">{news.title}</h3>
                  <p className="news-excerpt">{news.excerpt}</p>
                  <a href="#" className="news-link">Read More →</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* One Click Payout Section */}
      <section className="payout-section">
        <div className="container">
          <div className="payout-container">
            {/* Left Side - Trading Card Image */}
            <div className="payout-image">
              <div className="trading-card-mockup">
                <div className="card-header">
                  <span className="card-tab active">Buy</span>
                  <span className="card-tab">Sell</span>
                </div>
                <div className="card-content">
                  <div className="btc-price">
                    <p className="price-label">1 BTC is roughly</p>
                    <h3 className="price-value">53,260.20 <span>USD</span></h3>
                  </div>
                  <div className="input-field">
                    <input type="text" defaultValue="5000" readOnly />
                    <div className="currency-selector">
                      <span className="currency-icon">💵</span>
                      <span>USD</span>
                      <span className="dropdown-arrow">▼</span>
                    </div>
                  </div>
                  <div className="input-field">
                    <input type="text" defaultValue="0.8511" readOnly />
                    <div className="currency-selector">
                      <span className="currency-icon">₿</span>
                      <span>BTC</span>
                      <span className="dropdown-arrow">▼</span>
                    </div>
                  </div>
                  <button className="buy-now-btn">Buy Now</button>
                </div>
                <div className="visa-card"></div>
              </div>
            </div>

            {/* Right Side - Content */}
            <div className="payout-content">
              <h2 className="payout-title">One click, instant payout with credit or debit card.</h2>
              <p className="payout-desc">Become a crypto owner in minutes using your debit or credit card and quickly purchase top cryptocurrencies.</p>

              <div className="payment-methods">
                <p className="payment-label">We accept payment with many methods:</p>
                <div className="payment-icons">
                  <div className="payment-icon mastercard">
                    <div className="circle red"></div>
                    <div className="circle yellow"></div>
                  </div>
                  <div className="payment-icon">VISA</div>
                  <div className="payment-icon">Apple Pay</div>
                  <div className="payment-icon">Google Pay</div>
                  <div className="payment-icon">PayPal</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="container">
          <div className="features-container">
            {/* Left Side - Content */}
            <div className="features-content">
              <h2 className="features-main-title">The most trusted cryptocurrency platform.</h2>
              <p className="features-main-desc">FPMarkets has a variety of features that make it the best place to start trading.</p>

              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-item-icon" style={{ background: 'linear-gradient(135deg, #ff6b00, #ff9500)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="4"></circle>
                      <line x1="21.17" y1="8" x2="12" y2="8"></line>
                      <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
                      <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
                    </svg>
                  </div>
                  <div className="feature-item-text">
                    <h3 className="feature-item-title">Portfolio Manager</h3>
                    <p className="feature-item-desc">Buy and sell popular digital currencies, keep track of them in one place.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-item-icon" style={{ background: 'linear-gradient(135deg, #00d4aa, #00f5cc)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      <path d="M9 12l2 2 4-4"></path>
                    </svg>
                  </div>
                  <div className="feature-item-text">
                    <h3 className="feature-item-title">Vault Protection</h3>
                    <p className="feature-item-desc">For added security, store your funds in a vault with time delayed withdrawals.</p>
                  </div>
                </div>

                <div className="feature-item">
                  <div className="feature-item-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                      <line x1="12" y1="18" x2="12.01" y2="18"></line>
                    </svg>
                  </div>
                  <div className="feature-item-text">
                    <h3 className="feature-item-title">Mobile Apps</h3>
                    <p className="feature-item-desc">Stay on top of the markets with the FPMarkets app for Android or iOS.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Dashboard Image */}
            <div className="features-image">
              <img src="/assets/images/Mobile-crypto-app-1024x682.webp" alt="Trading Dashboard" className="dashboard-img" />
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust-section" id="about">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">We are the most trusted<br />cryptocurrency platform.</h2>
            <p className="section-subtitle">There are a few reasons why you should choose FPMarkets as your cryptocurrency platform</p>
          </div>

          <div className="trust-grid">
            <div className="trust-card">
              <div className="trust-card-icon" style={{ background: 'linear-gradient(135deg, #ff6b00, #ff9500)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="12" r="4"></circle>
                </svg>
              </div>
              <h3 className="trust-card-title">Clarity</h3>
              <p className="trust-card-desc">We help you make sense of the coins, the terms, the dense charts and market changes.</p>
            </div>

            <div className="trust-card">
              <div className="trust-card-icon" style={{ background: 'linear-gradient(135deg, #00d4aa, #00f5cc)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  <path d="M9 12l2 2 4-4"></path>
                </svg>
              </div>
              <h3 className="trust-card-title">Confidence</h3>
              <p className="trust-card-desc">Our markets are always up to date, sparking curiosity with real words from real traders.</p>
            </div>

            <div className="trust-card">
              <div className="trust-card-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <h3 className="trust-card-title">Community</h3>
              <p className="trust-card-desc">We support the crypto community, putting data in the hands which need it most.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section" id="faq">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Frequently Asked Questions</h2>
            <p className="section-subtitle">Find answers to common questions about trading, accounts, and support</p>
          </div>

          <div className="faq-container">
            {faqItems.map((faq, index) => (
              <div key={index} className={`faq-item ${expandedFAQ === index ? 'active' : ''}`}>
                <button
                  className="faq-question"
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  aria-expanded={expandedFAQ === index}
                >
                  <span className="question-text">{faq.question}</span>
                  <span className="faq-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </span>
                </button>
                <div className="faq-answer">
                  <div className="answer-content">
                    <p>{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Support CTA */}
          <div className="faq-footer">
            <h3 className="faq-footer-title">Still have questions?</h3>
            <p className="faq-footer-text">Our support team is here to help you 24/7</p>
            <div className="faq-cta-buttons">
              <button className="btn btn-gradient">Contact Support</button>
              <button className="btn btn-secondary">Visit Help Center</button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="logo">
                <span className="logo-text">FP<span className="logo-accent">Markets</span></span>
              </div>
              <p className="footer-tagline">The most trusted cryptocurrency exchange platform.</p>
            </div>
            
            <div className="footer-links">
              <div className="footer-column">
                <h4>Products</h4>
                <a href="#">Exchange</a>
                <a href="#">Wallet</a>
                <a href="#">Explorer</a>
              </div>
              <div className="footer-column">
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Careers</a>
                <a href="#">Blog</a>
              </div>
              <div className="footer-column">
                <h4>Support</h4>
                <a href="#">Help Center</a>
                <a href="#">Contact</a>
                <a href="#">Status</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 FPMarkets. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="logout-confirmation-overlay" onClick={cancelLogout}>
          <div className="logout-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to logout?</p>
            <div className="logout-confirmation-buttons">
              <button onClick={cancelLogout} className="logout-cancel-btn">
                Cancel
              </button>
              <button onClick={confirmLogout} className="logout-confirm-btn">
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
