import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Micro-Parallax Hook
 * Extremely subtle movement (2-5px) for floating elements
 * Perfect for hero section coins and decorative elements
 */
export function useMicroParallax() {
  useEffect(() => {
    const parallaxElements = document.querySelectorAll('[data-parallax]');

    parallaxElements.forEach((element) => {
      const speed = parseFloat(element.getAttribute('data-parallax-speed') || '0.02');
      const rotation = parseFloat(element.getAttribute('data-parallax-rotation') || '0.5');

      gsap.to(element, {
        y: () => ScrollTrigger.maxScroll(window) * speed,
        rotation: () => ScrollTrigger.maxScroll(window) * rotation,
        ease: 'none',
        scrollTrigger: {
          trigger: element,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.vars.trigger && (trigger.vars.trigger as Element).hasAttribute('data-parallax')) {
          trigger.kill();
        }
      });
    };
  }, []);
}

