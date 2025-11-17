import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface FloatingOptions {
  distance?: number; // Distance in pixels (default: 4)
  duration?: number; // Duration in seconds (default: 3)
  delay?: number; // Delay in seconds (default: 0)
  randomize?: boolean; // Randomize distance and duration (default: false)
}

/**
 * Floating Animation Hook
 * Smooth up/down floating animation (2-6px)
 */
export function useFloatingAnimation<T extends HTMLElement = HTMLDivElement>(
  options: FloatingOptions = {}
) {
  const elementRef = useRef<T>(null);
  const {
    distance = 4,
    duration = 3,
    delay = 0,
    randomize = false,
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const finalDistance = randomize
      ? distance + (Math.random() - 0.5) * 2
      : distance;
    const finalDuration = randomize
      ? duration + (Math.random() - 0.5) * 1
      : duration;

    const animation = gsap.to(element, {
      y: `+=${finalDistance}`,
      duration: finalDuration,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: delay,
    });

    return () => {
      animation.kill();
    };
  }, [distance, duration, delay, randomize]);

  return elementRef;
}

