import React from 'react';
import { NewsItem } from './../types/dashboard';

interface NewsCardProps {
  news: NewsItem;
  index: number;
}

const NewsCard: React.FC<NewsCardProps> = ({ news, index }) => {
  return (
    <div
      className="news-item card-3d"
      data-animate="slide-right"
      data-delay={9}
      data-stagger={index * 0.1}
      onClick={() => window.open(news.link || '#', '_blank', 'noopener,noreferrer')}
      style={{
        background: 'var(--card-bg, #1a1f3a)',
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
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
        height: '100px',
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
        padding: '10px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
          fontSize: '9px',
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
          fontSize: '12px',
          fontWeight: '700',
          marginBottom: '4px',
          color: 'var(--text-primary, #ffffff)',
          lineHeight: '1.3',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>{news.title}</h3>

        <p style={{
          fontSize: '10px',
          color: 'var(--text-secondary, #8892b0)',
          lineHeight: '1.4',
          marginBottom: '6px',
          flex: 1,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>{news.excerpt}</p>

        <a
          href={news.link || '#'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#FDDB92',
            fontSize: '10px',
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
  );
};

export default NewsCard;