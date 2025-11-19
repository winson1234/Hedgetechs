import { useEffect, useState } from 'react';

interface Section {
  id: string;
  label: string;
}

const SECTIONS: Section[] = [
  { id: 'home', label: 'Home' },
  { id: 'market', label: 'Markets' },
  { id: 'news', label: 'News' },
  { id: 'features', label: 'Features' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
];

/**
 * Scroll Dots Navigation Component
 * Right-side navigation dots that indicate current section
 * Click to scroll to section
 */
export default function ScrollDots() {
  const [activeSection, setActiveSection] = useState<string>('home');
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Track scroll position to update active section
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 3;

      // Find current section
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const section = document.getElementById(SECTIONS[i].id);
        if (section) {
          const { offsetTop, offsetHeight } = section;
          if (scrollPosition >= offsetTop) {
            setActiveSection(SECTIONS[i].id);
            break;
          }
        }
      }

      // Hide dots when at very top or bottom
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setIsVisible(scrollPercent > 0.05 && scrollPercent < 0.95);
    };

    // Initial check
    handleScroll();

    // Listen to scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (section) {
      const headerOffset = 100; // Account for sticky header
      const elementPosition = section.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="scroll-dots"
      style={{
        position: 'fixed',
        right: '2rem',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className="scroll-dot"
            aria-label={`Scroll to ${section.label}`}
            style={{
              width: isActive ? '12px' : '8px',
              height: isActive ? '12px' : '8px',
              borderRadius: '50%',
              border: 'none',
              background: isActive
                ? 'linear-gradient(135deg, #C76D00, #FDDB92)'
                : 'rgba(253, 219, 146, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: 0,
              position: 'relative',
              boxShadow: isActive
                ? '0 0 12px rgba(253, 219, 146, 0.5)'
                : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(253, 219, 146, 0.6)';
                e.currentTarget.style.transform = 'scale(1.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'rgba(253, 219, 146, 0.3)';
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {/* Tooltip on hover */}
            <span
              style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--bg-card, #1a1f3a)',
                color: 'var(--text-primary, #ffffff)',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                opacity: 0,
                pointerEvents: 'none',
                transition: 'opacity 0.2s ease',
                border: '1px solid rgba(253, 219, 146, 0.2)',
              }}
              className="scroll-dot-tooltip"
            >
              {section.label}
            </span>
          </button>
        );
      })}
      
      <style>{`
        .scroll-dot:hover .scroll-dot-tooltip {
          opacity: 1 !important;
        }
        
        @media (max-width: 768px) {
          .scroll-dots {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

