import { useEffect, useRef } from 'react';

interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  parallaxSpeed?: number;
}

/**
 * Lightweight scroll animation hook
 * Optimized for stability and performance while keeping all effects
 */
export function useScrollAnimations(options: ScrollAnimationOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    parallaxSpeed = 0.3,
  } = options;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const textObserverRef = useRef<IntersectionObserver | null>(null);
  const hasScrolledDownRef = useRef(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    // Track scroll direction
    const handleScrollDirection = () => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 50) {
        hasScrolledDownRef.current = true;
      }
      lastScrollYRef.current = currentScrollY;
    };

    // 1. GENERAL OBSERVER
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            entry.target.classList.remove('animate-out');
          }
        });
      },
      { threshold, rootMargin: rootMargin || '-100px' }
    );

    // 2. SECTION VISIBILITY OBSERVER
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-visible');
            
            const sectionHeader = entry.target.querySelector('.section-header');
            const sectionTitle = entry.target.querySelector('.section-title');
            const sectionSubtitle = entry.target.querySelector('.section-subtitle');
            
            if (sectionHeader && !sectionHeader.classList.contains('animate-in')) {
              sectionHeader.classList.add('animate-in');
              if (sectionTitle) setTimeout(() => sectionTitle.classList.add('animate-in'), 100);
              if (sectionSubtitle) setTimeout(() => sectionSubtitle.classList.add('animate-in'), 200);
            } else if (sectionTitle && !sectionTitle.classList.contains('animate-in')) {
              sectionTitle.classList.add('animate-in');
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '-50px' }
    );

    // 3. ELEMENT DISCOVERY (Kept your original logic)
    const observeElements = () => {
      const animatedElements = document.querySelectorAll('[data-scroll-animate]');
      animatedElements.forEach((el) => {
        if (!el.classList.contains('animate-in')) {
          const isHeroElement = el.closest('.hero') !== null;
          if (isHeroElement) {
            el.classList.add('animate-in');
          } else {
            observerRef.current?.observe(el);
          }
        }
      });
    };

    const observeSections = () => {
      const sections = document.querySelectorAll('section');
      sections.forEach((section) => {
        if (!section.classList.contains('hero')) {
          sectionObserver.observe(section);
        }
      });
    };

    // 4. TEXT OBSERVER
    textObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            if (entry.target.classList.contains('section-header')) {
              const title = entry.target.querySelector('.section-title');
              const subtitle = entry.target.querySelector('.section-subtitle');
              if (title && !title.classList.contains('animate-in')) {
                setTimeout(() => title.classList.add('animate-in'), 100);
              }
              if (subtitle && !subtitle.classList.contains('animate-in')) {
                setTimeout(() => subtitle.classList.add('animate-in'), 200);
              }
            }
          }
        });
      },
      { threshold: 0.2, rootMargin: '-50px' }
    );

    const observeSectionText = () => {
      const sectionHeaders = document.querySelectorAll('.section-header:not(.animate-in)');
      sectionHeaders.forEach((el) => textObserverRef.current?.observe(el));
      
      const standaloneText = document.querySelectorAll(
        '.section-title:not(.animate-in), .features-main-title:not(.animate-in), .payout-title:not(.animate-in), .section-subtitle:not(.animate-in), .features-main-desc:not(.animate-in), .payout-desc:not(.animate-in)'
      );

      standaloneText.forEach((el) => {
        if (!el.closest('.section-header')) {
          observerRef.current?.observe(el);
        }
      });
    };

    // Initial Calls
    observeElements();
    observeSections();
    observeSectionText();
    
    // Keep intervals (Robustness for dynamic content)
    const textObserverInterval = setInterval(observeSectionText, 500);
    const observeInterval = setInterval(observeElements, 500);

    // ==================================================
    // OPTIMIZED PARALLAX (Animation Frame Wrapper)
    // ==================================================
    const parallaxElements = document.querySelectorAll<HTMLElement>('[data-parallax]');
    let scrollHandler: (() => void) | null = null;
    
    if (parallaxSpeed > 0 && parallaxElements.length > 0) {
      const handleParallax = () => {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        
        parallaxElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          
          // Only calculate if visible (Huge performance win)
          if (rect.bottom > 0 && rect.top < windowHeight) {
            const speed = parseFloat(element.dataset.parallax || String(parallaxSpeed));
            const elementTop = rect.top + scrollY;
            const yPos = (scrollY - elementTop + windowHeight / 2) * speed;
            
            // Use translate3d for GPU acceleration
            element.style.transform = `translate3d(0, ${yPos}px, 0)`;
          }
        });
      };

      // Sync with screen refresh rate (60fps)
      let ticking = false;
      scrollHandler = () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            handleParallax();
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener('scroll', scrollHandler, { passive: true });
      window.addEventListener('resize', scrollHandler, { passive: true });
    }

    window.addEventListener('scroll', handleScrollDirection, { passive: true });

    // Cleanup
    return () => {
      clearInterval(observeInterval);
      clearInterval(textObserverInterval);
      observerRef.current?.disconnect();
      sectionObserver.disconnect();
      textObserverRef.current?.disconnect();
      window.removeEventListener('scroll', handleScrollDirection);
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
        window.removeEventListener('resize', scrollHandler);
      }
    };
  }, [threshold, rootMargin, parallaxSpeed]);

  return null;
}