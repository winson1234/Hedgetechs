import React from 'react';
import { Section } from './../types/dashboard';

interface SectionNavigationDotsProps {
  currentSection: number;
  sections: Section[];
  scrollToSection: (index: number) => void;
}

export const SectionNavigationDots: React.FC<SectionNavigationDotsProps> = ({ 
  currentSection, 
  sections, 
  scrollToSection 
}) => {
  return (
    <div style={{
      position: 'fixed',
      right: '2rem',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      pointerEvents: 'auto'
    }}>
      {sections.map((section, index) => (
        <button
          key={section.id}
          onClick={() => scrollToSection(index)}
          title={section.name}
          style={{
            width: currentSection === index ? '12px' : '8px',
            height: currentSection === index ? '12px' : '8px',
            borderRadius: '50%',
            border: 'none',
            background: currentSection === index 
              ? 'linear-gradient(135deg, #C76D00, #FDDB92)'
              : 'rgba(255, 255, 255, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            padding: 0,
            position: 'relative',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}
          onMouseEnter={(e) => {
            if (currentSection !== index) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
              e.currentTarget.style.transform = 'scale(1.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (currentSection !== index) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          <span style={{
            position: 'absolute',
            right: '1.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            whiteSpace: 'nowrap',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#fff',
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '0.25rem 0.75rem',
            borderRadius: '4px',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease'
          }}
          className="tooltip">
            {section.name}
          </span>
        </button>
      ))}
      <style>{`
        button:hover .tooltip {
          opacity: 1;
        }
        @media (max-width: 768px) {
          div[style*="position: fixed"] {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};