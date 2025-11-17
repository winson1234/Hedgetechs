import { useEffect, useRef } from 'react';

interface ScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  parallaxSpeed?: number;
}

/**
 * Lightweight scroll animation hook for modern 2026-style effects
 * Provides fade-ins, slide-ins, parallax, and scaling animations
 */
export function useScrollAnimations(options: ScrollAnimationOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    parallaxSpeed = 0.3,
  } = options;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const textObserverRef = useRef<IntersectionObserver | null>(null);
  const lastScrollYRef = useRef(0);
  const hasScrolledDownRef = useRef(false);

  useEffect(() => {
    // Track scroll direction - only animate on scroll down
    const handleScrollDirection = () => {
      const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // Check if user has scrolled down (not just initial load)
      if (currentScrollY > lastScrollYRef.current && currentScrollY > 50) {
        hasScrolledDownRef.current = true;
      }
      
      lastScrollYRef.current = currentScrollY;
    };

    // Initialize Intersection Observer for scroll-triggered animations
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            entry.target.classList.remove('animate-out');
          }
        });
      },
      {
        threshold,
        rootMargin: rootMargin || '-100px',
      }
    );

    // Section observer for smooth section transitions
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('scroll-visible');
            
            // Also animate section header and title when section becomes visible
            const sectionHeader = entry.target.querySelector('.section-header');
            const sectionTitle = entry.target.querySelector('.section-title');
            const sectionSubtitle = entry.target.querySelector('.section-subtitle');
            
            if (sectionHeader && !sectionHeader.classList.contains('animate-in')) {
              sectionHeader.classList.add('animate-in');
              // Animate title after header
              if (sectionTitle) {
                setTimeout(() => sectionTitle.classList.add('animate-in'), 100);
              }
              // Animate subtitle after title
              if (sectionSubtitle) {
                setTimeout(() => sectionSubtitle.classList.add('animate-in'), 200);
              }
            } else if (sectionTitle && !sectionTitle.classList.contains('animate-in')) {
              // If no header, animate title directly
              sectionTitle.classList.add('animate-in');
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '-50px',
      }
    );

    // Observe all elements with data-scroll-animate attribute
    const observeElements = () => {
      const animatedElements = document.querySelectorAll('[data-scroll-animate]');
      animatedElements.forEach((el) => {
        if (!el.classList.contains('animate-in')) {
          // Hero section elements should animate immediately on page load
          const isHeroElement = el.closest('.hero') !== null;
          if (isHeroElement) {
            // Immediately animate hero elements without waiting for scroll
            el.classList.add('animate-in');
          } else {
            observerRef.current?.observe(el);
          }
        }
      });
    };

    // Animate hero section immediately on load
    const animateHeroSection = () => {
      const heroSection = document.querySelector('.hero');
      if (heroSection) {
        const heroElements = heroSection.querySelectorAll('[data-scroll-animate]');
        heroElements.forEach((el, index) => {
          setTimeout(() => {
            el.classList.add('animate-in');
          }, index * 100); // Stagger hero animations
        });
      }
    };

    // Observe all sections for smooth transitions
    const observeSections = () => {
      const sections = document.querySelectorAll('section');
      sections.forEach((section) => {
        if (!section.classList.contains('hero')) {
          sectionObserver.observe(section);
        }
      });
    };

    // Single observer for all section text elements (headers, titles, subtitles)
    textObserverRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            // Also animate child section-title and section-subtitle if in section-header
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
      {
        threshold: 0.2,
        rootMargin: '-50px',
      }
    );

    // Observe section headers and titles automatically
    const observeSectionText = () => {
      // Observe section headers (which contain titles and subtitles)
      const sectionHeaders = document.querySelectorAll('.section-header:not(.animate-in)');
      sectionHeaders.forEach((el) => {
        textObserverRef.current?.observe(el);
      });
      
      // Observe standalone section titles, features-main-title, payout-title
      const standaloneTitles = Array.from(document.querySelectorAll('.section-title:not(.animate-in)'));
      const featureTitles = Array.from(document.querySelectorAll('.features-main-title:not(.animate-in)'));
      const payoutTitles = Array.from(document.querySelectorAll('.payout-title:not(.animate-in)'));

      [...standaloneTitles, ...featureTitles, ...payoutTitles].forEach((el) => {
        // Skip if it's inside a section-header (will be handled by textObserver)
        if (!el.closest('.section-header')) {
          observerRef.current?.observe(el);
        }
      });
      
      // Observe standalone subtitles and descriptions
      const standaloneSubtitles = Array.from(document.querySelectorAll('.section-subtitle:not(.animate-in)'));
      const featureDescs = Array.from(document.querySelectorAll('.features-main-desc:not(.animate-in)'));
      const payoutDescs = Array.from(document.querySelectorAll('.payout-desc:not(.animate-in)'));

      [...standaloneSubtitles, ...featureDescs, ...payoutDescs].forEach((el) => {
        // Skip if it's inside a section-header (will be handled by textObserver)
        if (!el.closest('.section-header')) {
          observerRef.current?.observe(el);
        }
      });
    };

    // Initial observations
    observeElements();
    observeSections();
    observeSectionText();
    
    // Animate hero section immediately on page load
    animateHeroSection();
    
    // Also animate hero after a small delay to ensure DOM is ready
    setTimeout(() => {
      animateHeroSection();
    }, 100);

    // Re-observe section text elements periodically
    const textObserverInterval = setInterval(() => {
      observeSectionText();
    }, 500);

    // Re-observe dynamically added elements
    const observeInterval = setInterval(() => {
      observeElements();
    }, 500);

    // Initialize parallax elements with enhanced smoothness (disabled if speed is 0)
    const parallaxElements = document.querySelectorAll<HTMLElement>('[data-parallax]');
    
    // Define scroll handler outside if block for cleanup
    let scrollHandler: (() => void) | null = null;
    
    // Only set up parallax if speed is greater than 0
    if (parallaxSpeed > 0 && parallaxElements.length > 0) {
      const handleParallax = () => {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        parallaxElements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const speed = parseFloat(element.dataset.parallax || String(parallaxSpeed));
          
          // Enhanced parallax calculation
          const elementTop = rect.top + scrollY;
          const elementHeight = rect.height;
          const viewportHeight = window.innerHeight;
          
          // Only apply parallax when element is in or near viewport
          if (rect.bottom > -elementHeight && rect.top < viewportHeight + elementHeight) {
            const yPos = (scrollY - elementTop + viewportHeight / 2) * speed;
            element.style.transform = `translateY(${yPos}px)`;
          }
        });
      };

      // Throttled scroll handler for parallax
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
    } else {
      // Remove any existing parallax transforms when disabled
      parallaxElements.forEach((element) => {
        element.style.transform = '';
      });
    }

    // Add scroll direction tracking
    window.addEventListener('scroll', handleScrollDirection, { passive: true });

    return () => {
      clearInterval(observeInterval);
      clearInterval(textObserverInterval);
      const animatedElements = document.querySelectorAll('[data-scroll-animate]');
      animatedElements.forEach((el) => observerRef.current?.unobserve(el));
      const sections = document.querySelectorAll('section');
      sections.forEach((section) => sectionObserver.unobserve(section));
      const sectionHeaders = document.querySelectorAll('.section-header');
      sectionHeaders.forEach((header) => textObserverRef.current?.unobserve(header));
      window.removeEventListener('scroll', handleScrollDirection);
      if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler);
        window.removeEventListener('resize', scrollHandler);
      }
      observerRef.current?.disconnect();
      sectionObserver.disconnect();
      textObserverRef.current?.disconnect();
    };
  }, [threshold, rootMargin, parallaxSpeed]);

  return null;
}

