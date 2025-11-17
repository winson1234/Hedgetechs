import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger plugin
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollAnimationOptions {
  trigger?: string | HTMLElement;
  start?: string;
  end?: string;
  animation?: 'fade-up' | 'scale-in' | 'slide-up';
  duration?: number;
  delay?: number;
  stagger?: number;
}

/**
 * Premium GSAP ScrollTrigger Animations
 * Subtle, luxurious fade-up, scale-in, and slide-up effects
 */
export function useGSAPScrollAnimations() {
  const elementsRef = useRef<Map<string, gsap.core.Timeline>>(new Map());

  useEffect(() => {
    // Animate elements with data-gsap-animate attribute
    const animatedElements = document.querySelectorAll('[data-gsap-animate]');

    // FAQ items - stagger fade animation with container-based stagger (process first)
    const faqContainer = document.querySelector('.faq-container');
    if (faqContainer) {
      const staggerDelay = parseFloat(faqContainer.getAttribute('data-gsap-stagger-container') || '0.08');
      const faqItems = faqContainer.querySelectorAll('.faq-item[data-gsap-animate]');
      
      faqItems.forEach((item, index) => {
        const staggerValue = parseFloat(item.getAttribute('data-gsap-stagger') || String(index));
        const calculatedDelay = staggerValue * staggerDelay;
        
        // Set the delay attribute for the main handler
        item.setAttribute('data-gsap-delay', String(calculatedDelay));
      });
    }

    animatedElements.forEach((element, index) => {
      const animationType = element.getAttribute('data-gsap-animate') || 'fade-up';
      const delay = parseFloat(element.getAttribute('data-gsap-delay') || '0');
      const duration = parseFloat(element.getAttribute('data-gsap-duration') || '1');
      const stagger = parseFloat(element.getAttribute('data-gsap-stagger') || '0');

      // Set initial state based on animation type
      let initialY = 30;
      let initialScale = 1;
      let easeType = 'power3.out';

      if (animationType === 'luxe-fade-up') {
        initialY = 15;
        initialScale = 0.99;
        easeType = 'power1.out';
      } else if (animationType === 'fade-up') {
        initialY = 20; // Reduced for smoother FAQ animation
      } else if (animationType === 'slide-up') {
        initialY = 20;
      } else if (animationType === 'scale-in') {
        initialScale = 0.95;
      }

      gsap.set(element, {
        opacity: 0,
        y: initialY,
        scale: initialScale,
      });

      // Create animation
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: element,
          start: 'top 85%',
          end: 'bottom 20%',
          toggleActions: 'play none none reverse',
        },
      });

      tl.to(element, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: duration,
        delay: delay, // Use the calculated delay (stagger already included)
        ease: easeType,
      });

      elementsRef.current.set(`element-${index}`, tl);
    });

    // Animate all section content elements with short fade-in
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
    ];

    sectionContentSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, index) => {
        // Skip if already animated
        if (element.hasAttribute('data-gsap-animate')) return;

        gsap.set(element, {
          opacity: 0,
          y: 15,
        });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: element,
            start: 'top 90%',
            toggleActions: 'play none none reverse',
          },
        });

        tl.to(element, {
          opacity: 1,
          y: 0,
          duration: 0.4, // Short duration - not too long
          delay: index * 0.03, // Small stagger
          ease: 'power2.out',
        });

        elementsRef.current.set(`content-${selector}-${index}`, tl);
      });
    });


    // Trust section - faster animations
    const trustGrid = document.querySelector('.trust-grid');
    const trustCards = document.querySelectorAll('.trust-card');
    const trustSectionHeader = document.querySelector('.trust-section .section-header');

    if (trustSectionHeader && !trustSectionHeader.hasAttribute('data-gsap-animate')) {
      gsap.set(trustSectionHeader, {
        opacity: 0,
        y: 10,
      });

      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: trustSectionHeader,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      });

      headerTl.to(trustSectionHeader, {
        opacity: 1,
        y: 0,
        duration: 0.3, // Very short
        ease: 'power2.out',
      });

      elementsRef.current.set('trust-header', headerTl);
    }

    if (trustGrid) {
      gsap.set(trustGrid, {
        opacity: 0,
        y: 10,
      });

      const gridTl = gsap.timeline({
        scrollTrigger: {
          trigger: trustGrid,
          start: 'top 90%',
          toggleActions: 'play none none reverse',
        },
      });

      gridTl.to(trustGrid, {
        opacity: 1,
        y: 0,
        duration: 0.25, // Very short
        ease: 'power2.out',
      });

      elementsRef.current.set('trust-grid', gridTl);
    }

    // Trust cards - luxe fade-up animations (handled by data-gsap-animate)

    // Cleanup
    return () => {
      elementsRef.current.forEach((animation) => {
        animation.kill();
      });
      elementsRef.current.clear();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return elementsRef.current;
}

