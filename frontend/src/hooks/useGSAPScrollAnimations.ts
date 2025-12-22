import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * ✅ FIXED: Section-based GSAP Animations
 * Uses visibility detection instead of scroll position
 */
export function useGSAPScrollAnimations() {
  const elementsRef = useRef<Map<string, gsap.core.Timeline>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // ✅ Use IntersectionObserver instead of ScrollTrigger
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target;
            
            // Trigger animation when visible
            const animationType = element.getAttribute('data-gsap-animate') || 'fade-up';
            const delay = parseFloat(element.getAttribute('data-gsap-delay') || '0');
            const duration = parseFloat(element.getAttribute('data-gsap-duration') || '0.8');

            let initialY = 30;
            let initialScale = 1;
            let easeType = 'power3.out';

            if (animationType === 'luxe-fade-up') {
              initialY = 15;
              initialScale = 0.99;
              easeType = 'power1.out';
            } else if (animationType === 'fade-up') {
              initialY = 20;
            } else if (animationType === 'slide-up') {
              initialY = 20;
            } else if (animationType === 'scale-in') {
              initialScale = 0.95;
              initialY = 0;
            }

            // Animate immediately when visible
            gsap.fromTo(
              element,
              {
                opacity: 0,
                y: initialY,
                scale: initialScale,
              },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: duration,
                delay: delay,
                ease: easeType,
              }
            );

            // Stop observing after animation
            observerRef.current?.unobserve(element);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px',
      }
    );

    // Observe all animated elements
    const animatedElements = document.querySelectorAll('[data-gsap-animate]');
    
    // Handle FAQ stagger
    const faqContainer = document.querySelector('.faq-container');
    if (faqContainer) {
      const staggerDelay = parseFloat(faqContainer.getAttribute('data-gsap-stagger-container') || '0.08');
      const faqItems = faqContainer.querySelectorAll('.faq-item[data-gsap-animate]');
      
      faqItems.forEach((item, index) => {
        const staggerValue = parseFloat(item.getAttribute('data-gsap-stagger') || String(index));
        const calculatedDelay = staggerValue * staggerDelay;
        item.setAttribute('data-gsap-delay', String(calculatedDelay));
      });
    }

    animatedElements.forEach((element) => {
      observerRef.current?.observe(element);
    });

    // Animate section content
    const sectionContentSelectors = [
      '.market-tabs',
      '.crypto-table',
      '.crypto-row',
      '.news-grid',
      '.news-item',
      '.features-container',
      '.features-content',
      '.features-list',
      '.feature-item',
      '.faq-container',
      '.payout-container',
      '.pagination',
      '.trust-grid',
    ];

    const contentObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.fromTo(
              entry.target,
              { opacity: 0, y: 15 },
              {
                opacity: 1,
                y: 0,
                duration: 0.5,
                ease: 'power2.out',
              }
            );
            contentObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    sectionContentSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (!element.hasAttribute('data-gsap-animate')) {
          contentObserver.observe(element);
        }
      });
    });

    // Capture ref value at effect start for cleanup
    const elementsRefValue = elementsRef.current;
    const observerRefValue = observerRef.current;

    // Cleanup
    return () => {
      observerRefValue?.disconnect();
      contentObserver.disconnect();
      elementsRefValue.forEach((animation) => animation.kill());
      elementsRefValue.clear();
    };
  }, []);

  return elementsRef.current;
}