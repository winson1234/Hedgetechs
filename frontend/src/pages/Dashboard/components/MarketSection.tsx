import React, { useState } from 'react';
import { useCryptoData } from './../hooks/useCryptoData';
import { usePagination } from './../hooks/usePagination';
import { Pagination } from './Pagination';
import CryptoTable from './CryptoTable';

interface MarketSectionProps {
  isDarkMode: boolean;
}

const MarketSection: React.FC<MarketSectionProps> = ({ isDarkMode }) => {
  const [activeMarketTab, setActiveMarketTab] = useState('all');
  const { cryptoData } = useCryptoData();

  // Filter crypto based on active tab
  const filteredCrypto = activeMarketTab === 'all'
    ? [...cryptoData].sort((a, b) => b.volume24h - a.volume24h)
    : activeMarketTab === 'popular'
    ? [...cryptoData].sort((a, b) => b.volume24h - a.volume24h).slice(0, 10)
    : activeMarketTab === 'gainers'
    ? cryptoData.filter(c => c.change > 0).sort((a, b) => b.change - a.change)
    : cryptoData.filter(c => c.change < 0).sort((a, b) => a.change - b.change);

  const {
    currentPage,
    totalPages,
    displayedItems: displayedCrypto,
    handlePageChange,
  } = usePagination(filteredCrypto, 6);

  const handleCryptoPageChange = (page: number) => {
    handlePageChange(page);
    document.getElementById('market')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="market-section" id="market">
      <div className="container">
        <div className="section-header" style={{ textAlign: 'center' }} data-animate="slide-left" data-delay="2">
          <h2 className="section-title" style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }} data-animate data-delay="1" data-gsap-delay="0.1">
            Today&apos;s Cryptocurrency Prices
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.9rem', marginTop: '1', marginBottom: '-1rem' }} data-animate="slide-right" data-delay="1">
            Track real-time prices and 24-hour trading volume across major cryptocurrencies
          </p>
        </div>

        {/* Market Tabs */}
        <div className="market-tabs" style={{ justifyContent: 'center' }} data-animate="zoom-in" data-delay="2">
          <button className={`market-tab ${activeMarketTab === 'all' ? 'active' : ''}`} onClick={() => setActiveMarketTab('all')}>
            <span className="tab-icon">🪙</span>
            All Coins
          </button>
          <button className={`market-tab ${activeMarketTab === 'popular' ? 'active' : ''}`} onClick={() => setActiveMarketTab('popular')}>
            <span className="tab-icon">🔥</span>
            Popular Coins
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

        {/* Crypto Table */}
        <CryptoTable displayedCrypto={displayedCrypto} />

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handleCryptoPageChange}
          isDarkMode={isDarkMode}
        />
      </div>
    </section>
  );
};

export default MarketSection;