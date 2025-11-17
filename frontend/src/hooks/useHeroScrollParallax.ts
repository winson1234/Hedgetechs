import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Hero Image Scroll Parallax Hook
 * Subtle movement of hero image when scrolling
 */
export function useHeroScrollParallax<T extends HTMLElement = HTMLImageElement>(
  speed: number = 0.1
) {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    let parallax: gsap.core.Tween | null = null;
    let rafId: number | null = null;

    // Wait for ref to be set
    const initParallax = () => {
      const element = elementRef.current;
      if (!element) {
        rafId = requestAnimationFrame(initParallax);
        return;
      }

      parallax = gsap.to(element, {
        y: () => ScrollTrigger.maxScroll(window) * speed,
        ease: 'none',
        scrollTrigger: {
          trigger: element.closest('section') || element,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1,
        },
      });
    };

    initParallax();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (parallax) parallax.kill();
      ScrollTrigger.getAll().forEach((trigger) => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const element = elementRef.current;
        if (element && (trigger.vars.trigger === element || trigger.vars.trigger === element.closest('section'))) {
          trigger.kill();
        }
      });
    };
  }, [speed]);

  return elementRef;
}

