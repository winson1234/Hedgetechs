import React, { useState } from 'react';
import { Section } from './../types/dashboard';

interface SectionIndicatorProps {
  currentSection: number;
  sections: Section[];
}

export const SectionIndicator: React.FC<SectionIndicatorProps> = ({
  currentSection,
  sections
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: isExpanded ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.1)',
        backdropFilter: isExpanded ? 'blur(10px)' : 'blur(5px)',
        padding: isExpanded ? '0.75rem 1.5rem' : '0.5rem 1rem',
        borderRadius: '50px',
        color: '#fff',
        fontSize: '0.875rem',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        border: isExpanded ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.05)',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        opacity: isExpanded ? 1 : 0.3,
        pointerEvents: 'auto'
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) {
          e.currentTarget.style.opacity = '0.6';
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          e.currentTarget.style.opacity = '0.3';
        }
      }}
    >
      <span style={{ color: '#FDDB92' }}>{currentSection + 1}</span>
      <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>/</span>
      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>{sections.length}</span>
      {isExpanded && (
        <span style={{
          marginLeft: '0.5rem',
          color: '#fff'
        }}>
          {sections[currentSection].name}
        </span>
      )}
    </div>
  );
};