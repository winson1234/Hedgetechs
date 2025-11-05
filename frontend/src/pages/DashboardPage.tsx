import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { WebSocketContext } from '../context/WebSocketContext';
import MiniSparklineChart from '../components/MiniSparklineChart';
import './dashboard.css';

interface CryptoData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  filter: string;
  icon: string;
  gradient: string;
}

export default function DashboardPage() {
  const { isLoggedIn, user, logout } = useAuthStore();
  const ws = useContext(WebSocketContext);
  const [activeMarketTab, setActiveMarketTab] = useState('popular');
  const [activeNewsTab, setActiveNewsTab] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('EN');
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Real-time cryptocurrency data from WebSocket
  const [cryptoData, setCryptoData] = useState<CryptoData[]>([
    { symbol: 'BTCUSDT', name: 'Bitcoin', price: 0, change: 0, filter: 'popular', icon: '₿', gradient: 'linear-gradient(135deg, #f7931a, #ff9500)' },
    { symbol: 'ETHUSDT', name: 'Ethereum', price: 0, change: 0, filter: 'popular', icon: 'Ξ', gradient: 'linear-gradient(135deg, #627eea, #8a9cff)' },
    { symbol: 'BNBUSDT', name: 'Binance Coin', price: 0, change: 0, filter: 'popular', icon: 'B', gradient: 'linear-gradient(135deg, #f3ba2f, #ffd700)' },
    { symbol: 'SOLUSDT', name: 'Solana', price: 0, change: 0, filter: 'popular', icon: '◎', gradient: 'linear-gradient(135deg, #9945ff, #14f195)' },
    { symbol: 'ADAUSDT', name: 'Cardano', price: 0, change: 0, filter: 'popular', icon: '₳', gradient: 'linear-gradient(135deg, #0033ad, #3468d6)' },
    { symbol: 'XRPUSDT', name: 'Ripple', price: 0, change: 0, filter: 'popular', icon: '✕', gradient: 'linear-gradient(135deg, #23292f, #3d4853)' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0, change: 0, filter: 'popular', icon: 'Ð', gradient: 'linear-gradient(135deg, #c2a633, #f0d068)' },
    { symbol: 'MATICUSDT', name: 'Polygon', price: 0, change: 0, filter: 'new', icon: '⬡', gradient: 'linear-gradient(135deg, #8247e5, #a77bf3)' },
    { symbol: 'DOTUSDT', name: 'Polkadot', price: 0, change: 0, filter: 'new', icon: '●', gradient: 'linear-gradient(135deg, #e6007a, #ff4d9e)' },
    { symbol: 'AVAXUSDT', name: 'Avalanche', price: 0, change: 0, filter: 'new', icon: '▲', gradient: 'linear-gradient(135deg, #e84142, #ff6b6b)' },
    { symbol: 'LINKUSDT', name: 'Chainlink', price: 0, change: 0, filter: 'new', icon: '⬡', gradient: 'linear-gradient(135deg, #2a5ada, #5c8bf5)' },
    { symbol: 'UNIUSDT', name: 'Uniswap', price: 0, change: 0, filter: 'new', icon: '🦄', gradient: 'linear-gradient(135deg, #ff007a, #ff6bae)' },
    { symbol: 'LTCUSDT', name: 'Litecoin', price: 0, change: 0, filter: 'new', icon: 'Ł', gradient: 'linear-gradient(135deg, #345d9d, #5c8bd6)' },
  ]);

  // Store previous prices to calculate change
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});

  const handleLogout = () => {
    setShowLogoutModal(true);
    setProfileDropdownOpen(false);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    logout();
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

  // WebSocket message handler for real-time price updates
  useEffect(() => {
    if (!ws?.lastMessage) return;

    const data = ws.lastMessage;

    // Handle trade updates from Binance
    if (data.type === 'trade') {
      const price = parseFloat(data.price);
      const symbol = data.symbol;

      setCryptoData(prevData =>
        prevData.map(crypto => {
          if (crypto.symbol === symbol) {
            // Calculate percentage change from previous price
            const prevPrice = prevPrices[symbol] || price;
            const changePercent = ((price - prevPrice) / prevPrice) * 100;

            return {
              ...crypto,
              price,
              change: changePercent,
            };
          }
          return crypto;
        })
      );
    }
  }, [ws?.lastMessage, prevPrices]);

  // Fetch initial 24h ticker data for baseline prices and changes
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Use relative URL in production, localhost in dev
        const baseUrl = import.meta.env.MODE === 'development'
          ? 'http://localhost:8080'
          : '';

        const symbols = cryptoData.map(c => c.symbol).join(',');
        const response = await fetch(`${baseUrl}/api/v1/ticker?symbols=${symbols}`);

        if (!response.ok) {
          console.error('Failed to fetch ticker data');
          return;
        }

        const tickerData = await response.json();

        // Update crypto data with 24h statistics
        setCryptoData(prevData =>
          prevData.map(crypto => {
            const ticker = tickerData.find((t: any) => t.symbol === crypto.symbol);
            if (ticker) {
              const price = parseFloat(ticker.lastPrice);
              const change = parseFloat(ticker.priceChangePercent);

              // Store initial price for change calculations
              setPrevPrices(prev => ({ ...prev, [crypto.symbol]: price }));

              return {
                ...crypto,
                price,
                change,
              };
            }
            return crypto;
          })
        );
      } catch (err) {
        console.error('Error fetching initial ticker data:', err);
      }
    };

    fetchInitialData();
  }, []); // Only run once on mount

  // Live news data from API
  const [newsItems, setNewsItems] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Fetch live news from backend API
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);

        // Use relative URL in production, localhost in dev
        const baseUrl = import.meta.env.MODE === 'development'
          ? 'http://localhost:8080'
          : '';

        const response = await fetch(`${baseUrl}/api/v1/news`);

        if (!response.ok) {
          console.error('Failed to fetch news');
          return;
        }

        const newsData = await response.json();

        // Extract articles array from response
        const articles = newsData.articles || [];

        // Transform API response to match component structure
        const transformedNews = articles.map((article: any, index: number) => {
          const category = getCategoryFromArticle(article);
          return {
            id: index + 1,
            title: article.title,
            excerpt: article.description || article.title,
            source: article.source,
            category: category,
            timestamp: formatTimestamp(article.pubDate || article.publishedAt),
            featured: index === 0, // Make first article featured
            image: getPlaceholderImage(category, index), // Use placeholder images
            link: article.link,
          };
        });

        setNewsItems(transformedNews);
      } catch (err) {
        console.error('Error fetching news:', err);
      } finally {
        setNewsLoading(false);
      }
    };

    // Helper function to determine category from title and description
    const getCategoryFromArticle = (article: any) => {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const source = (article.source || '').toLowerCase();
      const text = `${title} ${description}`;

      // Check for regulation keywords
      const regulationKeywords = ['regulation', 'regulatory', 'sec', 'compliance', 'law', 'legal', 'government', 'policy', 'ban', 'lawsuit'];
      if (regulationKeywords.some(keyword => text.includes(keyword))) {
        return 'regulation';
      }

      // Check for technology keywords
      const techKeywords = ['blockchain', 'technology', 'protocol', 'layer 2', 'defi', 'nft', 'smart contract', 'upgrade', 'network', 'infrastructure'];
      if (techKeywords.some(keyword => text.includes(keyword))) {
        return 'technology';
      }

      // Check for crypto sources/keywords
      if (source.includes('coindesk') || source.includes('cryptonews') || source.includes('cointelegraph') ||
          text.includes('bitcoin') || text.includes('ethereum') || text.includes('crypto')) {
        return 'crypto';
      }

      // Check for market sources
      if (source.includes('fxstreet') || source.includes('investing') || source.includes('yahoo')) {
        return 'markets';
      }

      return 'crypto'; // default
    };

    // Helper function to get placeholder image based on category with more variety
    const getPlaceholderImage = (category: string, index: number) => {
      const cryptoImages = [
        'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1640826514546-7d2d259a2f6c?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1644088379091-d574269d422f?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1609554496796-c345a5335ceb?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1622707304787-b244e3d55c75?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1634704784915-aacf363b021f?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1623497421753-44869a9fc23c?w=800&q=80&fit=crop',
      ];

      const marketImages = [
        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1559526324-593bc073d938?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1560221328-12fe60f83ab8?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1579532537598-459ecdaf39cc?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1543286386-2e659306cd6c?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80&fit=crop',
      ];

      const techImages = [
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80&fit=crop',
      ];

      const regulationImages = [
        'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1561911341-7a293e0e5b92?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=800&q=80&fit=crop',
        'https://images.unsplash.com/photo-1453945619913-79ec89a82c51?w=800&q=80&fit=crop',
      ];

      let images = cryptoImages;
      if (category === 'markets') images = marketImages;
      else if (category === 'technology') images = techImages;
      else if (category === 'regulation') images = regulationImages;

      return images[index % images.length];
    };

    // Helper function to format timestamp
    const formatTimestamp = (timestamp: string) => {
      if (!timestamp) return 'Recently';

      const publishedDate = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - publishedDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      return publishedDate.toLocaleDateString();
    };

    fetchNews();

    // Refresh news every 2 minutes (matching backend cache TTL)
    const interval = setInterval(fetchNews, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

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

  // Pagination calculations
  const totalPages = Math.ceil(filteredNews.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedNews = filteredNews.slice(startIndex, endIndex);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeNewsTab]);

  // Handler for page changes
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to news section
    document.getElementById('news')?.scrollIntoView({ behavior: 'smooth' });
  };

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
                {theme === 'light' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1f3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" strokeWidth="2">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>

              {/* Language Selector */}
              <div className="language-selector">
                <button className="icon-btn" id="languageToggle" onClick={() => setLanguageMenuOpen(!languageMenuOpen)} title="Select Language">
                  <span id="languageLabel">{selectedLanguage}</span>
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
          <div className="section-header" style={{ textAlign: 'center' }}>
            <h2 className="section-title" style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              Today&apos;s Cryptocurrency Prices
            </h2>
            <p className="section-subtitle" style={{ fontSize: '1rem' }}>
              The global crypto market cap is <span className="market-cap-value">$2.89T</span> with 24h volume of <span className="market-volume-value">$120B</span>
            </p>
          </div>

          {/* Market Tabs */}
          <div className="market-tabs" style={{ justifyContent: 'center' }}>
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
              <div className="crypto-col" style={{ textAlign: 'left' }}>Asset</div>
              <div className="crypto-col" style={{ textAlign: 'center' }}>Last Price</div>
              <div className="crypto-col" style={{ textAlign: 'center' }}>24h Change</div>
              <div className="crypto-col" style={{ textAlign: 'center' }}>Chart</div>
              <div className="crypto-col" style={{ textAlign: 'center' }}>Trade</div>
            </div>

            {filteredCrypto.map(crypto => (
              <div key={crypto.symbol} className="crypto-row">
                <div className="crypto-col" style={{ textAlign: 'left' }}>
                  <div className="crypto-info">
                    <div className="crypto-icon" style={{ background: crypto.gradient }}>{crypto.icon}</div>
                    <div>
                      <div className="crypto-symbol">{crypto.symbol.replace('USDT', '')}</div>
                      <div className="crypto-name">{crypto.name}</div>
                    </div>
                  </div>
                </div>
                <div className="crypto-col crypto-price" style={{ textAlign: 'center' }}>
                  ${crypto.price > 0 ? crypto.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '—'}
                </div>
                <div className={`crypto-col crypto-change ${crypto.change > 0 ? 'positive' : 'negative'}`} style={{ textAlign: 'center' }}>
                  <span className="change-arrow">{crypto.change > 0 ? '▲' : '▼'}</span> {crypto.change > 0 ? '+' : ''}{crypto.change.toFixed(2)}%
                </div>
                <div className="crypto-col" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <MiniSparklineChart
                    symbol={crypto.symbol}
                    color={crypto.change > 0 ? '#10b981' : '#ef4444'}
                    width={120}
                    height={40}
                  />
                </div>
                <div className="crypto-col" style={{ textAlign: 'center' }}>
                  <Link to="/trading">
                    <button className="btn-trade">Buy</button>
                  </Link>
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
          <div className="section-header" style={{ textAlign: 'center' }}>
            <h2 className="section-title" style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              Latest Market News
            </h2>
            <p className="section-subtitle" style={{ fontSize: '1rem' }}>
              Stay updated with real-time crypto and financial headlines
            </p>
          </div>

          {/* News Filter Tabs */}
          <div className="news-tabs" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
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
          {newsLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '1.2rem' }}>Loading latest news...</div>
            </div>
          ) : displayedNews.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '1.2rem' }}>No news available for this category</div>
            </div>
          ) : (
            <>
              <div className="news-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '2rem',
                marginTop: '2rem'
              }}>
                {displayedNews.map(news => (
                <div key={news.id} className="news-item" style={{
                  background: 'var(--card-bg, #1a1f3a)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }} onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.3)';
                }} onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  <div className="news-badge" style={{
                    position: 'absolute',
                    top: '1rem',
                    left: '1rem',
                    zIndex: 10,
                    background: news.featured ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'rgba(0, 0, 0, 0.7)',
                    color: '#ffffff',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    {news.featured && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    )}
                    {news.featured ? 'Featured' : news.category.charAt(0).toUpperCase() + news.category.slice(1)}
                  </div>
                  <div style={{
                    position: 'relative',
                    height: '200px',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={news.image}
                      alt={news.title}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onError={(e) => {
                        // Fallback to a reliable default image if the original fails
                        const target = e.target as HTMLImageElement;
                        target.src = news.category === 'markets'
                          ? 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80&fit=crop'
                          : 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80&fit=crop';
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '50%',
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)'
                    }}></div>
                  </div>
                  <div style={{
                    padding: '1.5rem',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary, #8892b0)'
                    }}>
                      <span style={{ fontWeight: '600', color: '#FDDB92' }}>{news.source}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        {news.timestamp}
                      </span>
                    </div>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      marginBottom: '0.75rem',
                      color: 'var(--text-primary, #ffffff)',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>{news.title}</h3>
                    <p style={{
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary, #8892b0)',
                      lineHeight: '1.6',
                      marginBottom: '1rem',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>{news.excerpt}</p>
                    <a
                      href={news.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#FDDB92',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        transition: 'gap 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.gap = '0.6rem';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.gap = '0.3rem';
                      }}
                    >
                      Read More <span>→</span>
                    </a>
                  </div>
                </div>
              ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '3rem',
                  marginBottom: '2rem',
                  flexWrap: 'wrap'
                }}>
                  {/* Previous Button */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '0.75rem 1.25rem',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: currentPage === 1 ? '#64748b' : '#ffffff',
                      background: currentPage === 1 ? 'rgba(100, 116, 139, 0.2)' : 'rgba(102, 126, 234, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    Previous
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    // Show first page, last page, current page, and pages around current
                    const showPage = page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1);

                    const showEllipsis = (page === currentPage - 2 && currentPage > 3) ||
                                        (page === currentPage + 2 && currentPage < totalPages - 2);

                    if (showEllipsis) {
                      return (
                        <span key={page} style={{ color: '#64748b', padding: '0 0.5rem' }}>...</span>
                      );
                    }

                    if (!showPage) return null;

                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        style={{
                          padding: '0.75rem 1rem',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          color: '#ffffff',
                          background: page === currentPage
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'rgba(255, 255, 255, 0.1)',
                          border: page === currentPage ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          minWidth: '45px'
                        }}
                        onMouseEnter={(e) => {
                          if (page !== currentPage) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (page !== currentPage) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                          }
                        }}
                      >
                        {page}
                      </button>
                    );
                  })}

                  {/* Next Button */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '0.75rem 1.25rem',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      color: currentPage === totalPages ? '#64748b' : '#ffffff',
                      background: currentPage === totalPages ? 'rgba(100, 116, 139, 0.2)' : 'rgba(102, 126, 234, 0.8)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    Next
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              )}

              {/* Show current page info */}
              <div style={{
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                marginBottom: '2rem'
              }}>
                Page {currentPage} of {totalPages} • Showing {displayedNews.length} of {filteredNews.length} articles
              </div>
            </>
          )}
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
