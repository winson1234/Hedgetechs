import React, { useState } from 'react';
import { useNews } from './../hooks/useNews';
import { usePagination } from './../hooks/usePagination';
import { Pagination } from './Pagination';
import NewsCard from './NewsCard';

interface NewsSectionProps {
  isDarkMode: boolean;
}

const NewsSection: React.FC<NewsSectionProps> = ({ isDarkMode }) => {
  const [activeNewsTab, setActiveNewsTab] = useState('all');
  const { newsItems, newsLoading } = useNews();

  // Filter news based on active tab
  const filteredNews = activeNewsTab === 'all'
    ? newsItems
    : newsItems.filter(n => n.category === activeNewsTab);

  const {
    currentPage,
    totalPages,
    displayedItems: displayedNews,
    handlePageChange,
  } = usePagination(filteredNews, 6);

  const handleNewsPageChange = (page: number) => {
    handlePageChange(page);
    document.getElementById('news')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="news" className="news-section fade-in-left">
      <div className="container">
        {/* Section Header */}
        <div className="section-header" style={{ textAlign: 'center' }}>
          <h2 className="section-title" style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '2rem' }} data-animate="slide-left" data-delay="7">
            Latest Market News
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.9rem', marginBottom: '-1.2rem' }} data-animate="slide-left" data-delay="8.5">
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
            <div className="news-grid">
              {displayedNews.map((news, index) => (
                <NewsCard key={news.id} news={news} index={index} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handleNewsPageChange}
              isDarkMode={isDarkMode}
            />
          </>
        )}
      </div>
    </section>
  );
};

export default NewsSection;