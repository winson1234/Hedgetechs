import React from 'react';

interface ScrollProgressBarProps {
  currentSection: number;
  totalSections: number;
}

export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = ({ 
  currentSection, 
  totalSections 
}) => {
  const progress = ((currentSection + 1) / totalSections) * 100;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '3px',
      background: 'rgba(255, 255, 255, 0.1)',
      zIndex: 1000
    }}>
      <div style={{
        height: '100%',
        width: `${progress}%`,
        background: 'linear-gradient(90deg,  #00C0A2, #009b82)',
        transition: 'width 0.5s ease'
      }} />
    </div>
  );
};