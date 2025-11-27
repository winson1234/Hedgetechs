import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isDarkMode: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  isDarkMode
}) => {
  if (totalPages <= 1) return null;

  return (
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
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          padding: '0.75rem 1.25rem',
          fontSize: '0.9rem',
          fontWeight: '600',
          color: currentPage === 1 ? '#64748b' : '#ffffff',
          /* CHANGED: Dark Green #213B34 */
          background: currentPage === 1
            ? 'rgba(100, 116, 139, 0.2)'
            : 'linear-gradient(135deg, #213B34, #1c302a)',
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
            onClick={() => onPageChange(page)}
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: page === currentPage 
                ? '#ffffff' 
                : isDarkMode 
                  ? '#ffffff' 
                  : '#1a1f3a',
              /* CHANGED: Dark Green #213B34 for active page */
              background: page === currentPage
                ? 'linear-gradient(135deg, #213B34, #1c302a)'
                : isDarkMode
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.2)',
              border: page === currentPage 
                ? 'none' 
                : isDarkMode
                  ? '1px solid rgba(255, 255, 255, 0.3)'
                  : '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minWidth: '45px'
            }}
            onMouseEnter={(e) => {
              if (page !== currentPage) {
                e.currentTarget.style.background = isDarkMode 
                  ? 'rgba(255, 255, 255, 0.15)' 
                  : 'rgba(0, 0, 0, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (page !== currentPage) {
                e.currentTarget.style.background = isDarkMode
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(255, 255, 255, 0.2)';
              }
            }}
          >
            {page}
          </button>
        );
      })}

      {/* Next Button */}
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{
          padding: '0.75rem 1.25rem',
          fontSize: '0.9rem',
          fontWeight: '600',
          color: currentPage === totalPages ? '#64748b' : '#ffffff',
          /* CHANGED: Dark Green #213B34 */
          background: currentPage === totalPages
            ? 'rgba(100, 116, 139, 0.2)'
            : 'linear-gradient(135deg, #213B34, #1c302a)',
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
  );
};