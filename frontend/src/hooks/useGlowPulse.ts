import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface GlowPulseOptions {
  minOpacity?: number; // Minimum opacity (default: 0.4)
  maxOpacity?: number; // Maximum opacity (default: 0.8)
  duration?: number; // Pulse duration in seconds (default: 2)
}

/**
 * Soft Glow Pulse Hook
 * Gentle pulsing animation for neon edges/elements
 */
export function useGlowPulse<T extends HTMLElement = HTMLDivElement>(
  options: GlowPulseOptions = {}
) {
  const elementRef = useRef<T>(null);
  const {
    minOpacity = 0.4,
    maxOpacity = 0.8,
    duration = 2,
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Set initial opacity
    gsap.set(element, { opacity: minOpacity });

    const animation = gsap.to(element, {
      opacity: maxOpacity,
      duration: duration,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });

    return () => {
      animation.kill();
    };
  }, [minOpacity, maxOpacity, duration]);

  return elementRef;
}

