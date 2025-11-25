import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SECTIONS } from '../constants/dashboard';

export const useSectionScroll = () => {
  const [currentSection, setCurrentSection] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastUpdateRef = useRef(0);
  const wheelTimeoutRef = useRef<number | null>(null);
  const touchStartRef = useRef<number>(0);
  const sections = useMemo(() => SECTIONS, []);

  const updateSectionClasses = useCallback((activeIndex: number) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < 100) return;
    lastUpdateRef.current = now;

    sections.forEach((section, index) => {
      const element = document.getElementById(section.id);
      if (!element) return;

      element.classList.remove('section-active', 'section-above', 'section-below');

      if (index === activeIndex) {
        element.classList.add('section-active');
      } else if (index < activeIndex) {
        element.classList.add('section-above');
      } else {
        element.classList.add('section-below');
      }
    });
  }, [sections]);

  const scrollToSection = useCallback((index: number) => {
    if (isTransitioning || index < 0 || index >= sections.length) return;
    
    setIsTransitioning(true);
    setCurrentSection(index);
    updateSectionClasses(index);
    
    const section = document.getElementById(sections[index].id);
    if (section) {
      section.scrollIntoView({ 
        behavior: 'auto',
        block: 'center',
        inline: 'nearest'
      });

      if (typeof window !== 'undefined') {
        const targetId = sections[index].id;
        const hash = `#${targetId}`;
        if (window.location.hash !== hash) {
          window.history.replaceState(null, '', hash);
        }
      }
    }

    setTimeout(() => setIsTransitioning(false), 1200);
  }, [isTransitioning, sections, updateSectionClasses]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    updateSectionClasses(0);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isTransitioning) return;
      
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
      
      wheelTimeoutRef.current = window.setTimeout(() => {
        if (e.deltaY > 0 && currentSection < sections.length - 1) {
          scrollToSection(currentSection + 1);
        } else if (e.deltaY < 0 && currentSection > 0) {
          scrollToSection(currentSection - 1);
        }
      }, 10);
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTransitioning) return;
      
      const touchEnd = e.changedTouches[0].clientY;
      const diff = touchStartRef.current - touchEnd;
      
      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentSection < sections.length - 1) {
          scrollToSection(currentSection + 1);
        } else if (diff < 0 && currentSection > 0) {
          scrollToSection(currentSection - 1);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;
      
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        if (currentSection < sections.length - 1) {
          scrollToSection(currentSection + 1);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentSection > 0) {
          scrollToSection(currentSection - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToSection(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToSection(sections.length - 1);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, [currentSection, isTransitioning, scrollToSection, sections.length, updateSectionClasses]);

  return {
    currentSection,
    sections,
    scrollToSection
  };
};