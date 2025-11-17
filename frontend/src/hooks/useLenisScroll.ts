import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger if available
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Premium Lenis Smooth Scroll Hook
 * Buttery smooth, low-friction scrolling for 2026 premium feel
 * Integrated with GSAP ScrollTrigger for seamless animations
 */
export function useLenisScroll() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Initialize Lenis with premium settings
    const lenis = new Lenis({
      duration: 1.2, // Smooth duration
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Premium easing curve (Lenis default)
      // smooth: true,  // Not a valid Lenis option
      // smoothTouch: false, // Not a valid Lenis option in current version
      touchMultiplier: 2,
      infinite: false,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      autoRaf: false, // We'll handle raf manually to sync with GSAP
    });

    lenisRef.current = lenis;

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // Recalculate scroll height to prevent extra space
    const recalculateHeight = () => {
      lenis.resize();
      ScrollTrigger.refresh();
    };

    // Recalculate on load and resize
    window.addEventListener('load', recalculateHeight);
    window.addEventListener('resize', recalculateHeight);
    
    // Also recalculate after a short delay to ensure DOM is ready
    setTimeout(recalculateHeight, 100);
    setTimeout(recalculateHeight, 500);

    // Animation loop - sync with GSAP ticker
    const rafCallback = (time: number) => {
      lenis.raf(time * 1000); // Convert time from seconds to milliseconds
    };

    gsap.ticker.add(rafCallback);

    // Disable lag smoothing in GSAP to prevent delay in scroll animations
    gsap.ticker.lagSmoothing(0);

    // Cleanup
    return () => {
      gsap.ticker.remove(rafCallback);
      window.removeEventListener('load', recalculateHeight);
      window.removeEventListener('resize', recalculateHeight);
      lenis.destroy();
    };
  }, []);

  return lenisRef.current;
}

