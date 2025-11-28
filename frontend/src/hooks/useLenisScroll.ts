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
 * Optimized: Buttery smooth on Desktop, Native performance on Mobile
 * Integrated with GSAP ScrollTrigger
 */
export function useLenisScroll() {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // 1. MOBILE PERFORMANCE GUARD
    // Detect if device is mobile or tablet.
    // Mobile browsers have native momentum scrolling that is superior to JS emulation.
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    
    // 2. PREFERS REDUCED MOTION CHECK
    // Respect accessibility settings
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // If mobile or user wants less motion, DO NOT initialize Lenis.
    // This returns control to the native browser for maximum performance.
    if (isMobile || prefersReducedMotion) {
      // Ensure ScrollTrigger still works with native scroll
      ScrollTrigger.normalizeScroll(false); // Disable GSAP scroll hijacking on mobile
      return;
    }

    // Initialize Lenis with premium settings for Desktop only
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Exponential easing
      touchMultiplier: 2,
      infinite: false,
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      autoRaf: false, // We handle RAF manually
    });

    lenisRef.current = lenis;

    // Sync Lenis with GSAP ScrollTrigger
    // This ensures GSAP animations trigger at the exact right calculated pixel
    lenis.on('scroll', ScrollTrigger.update);

    // Recalculate layout to prevent "ghost" space
    const recalculateHeight = () => {
      lenis.resize();
      ScrollTrigger.refresh();
    };

    window.addEventListener('load', recalculateHeight);
    window.addEventListener('resize', recalculateHeight);
    
    // Backup recalculation for lazy-loaded images
    setTimeout(recalculateHeight, 500);

    // 3. ANIMATION LOOP - Optimized for 60/120Hz
    // Using GSAP ticker ensures scroll logic and animation logic happen in the same tick
    const rafCallback = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(rafCallback);

    // 4. STABILITY SETTING
    // Allow small amount of lag smoothing (500ms) to prevent jumping during CPU spikes,
    // but keep it low enough to feel responsive. 
    // '0' is too aggressive and causes teleports on hiccups.
    gsap.ticker.lagSmoothing(1000, 16);

    // Cleanup
    return () => {
      gsap.ticker.remove(rafCallback);
      window.removeEventListener('load', recalculateHeight);
      window.removeEventListener('resize', recalculateHeight);
      
      // Cleanly destroy instance
      lenis.destroy();
      
      // Reset ScrollTrigger to native handling
      ScrollTrigger.refresh();
    };
  }, []);

  return lenisRef.current;
}