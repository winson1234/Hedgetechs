import { useEffect, useRef } from 'react';

interface CursorParallaxOptions {
  rotation?: number; // Max rotation in degrees (default: 2)
  movement?: number; // Max movement in pixels (default: 5)
  smoothness?: number; // Smoothing factor 0-1 (default: 0.1)
}

/**
 * Micro Cursor Parallax Hook
 * Subtle 1-3 degree rotation + slight xy movement based on cursor position
 */
export function useCursorParallax<T extends HTMLElement = HTMLDivElement>(
  options: CursorParallaxOptions = {}
) {
  const elementRef = useRef<T>(null);
  const {
    rotation = 2,
    movement = 5,
    smoothness = 0.1,
  } = options;

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    let currentRotateX = 0;
    let currentRotateY = 0;
    let targetRotateX = 0;
    let targetRotateY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate distance from center (normalized -1 to 1)
      const x = (e.clientX - centerX) / (rect.width / 2);
      const y = (e.clientY - centerY) / (rect.height / 2);

      // Set target values
      targetX = x * movement;
      targetY = y * movement;
      targetRotateY = x * rotation;
      targetRotateX = -y * rotation; // Negative for natural tilt
    };

    const handleMouseLeave = () => {
      targetX = 0;
      targetY = 0;
      targetRotateX = 0;
      targetRotateY = 0;
    };

    // Smooth animation loop
    const animate = () => {
      // Lerp current values towards target
      currentX += (targetX - currentX) * smoothness;
      currentY += (targetY - currentY) * smoothness;
      currentRotateX += (targetRotateX - currentRotateX) * smoothness;
      currentRotateY += (targetRotateY - currentRotateY) * smoothness;

      // Apply transform
      element.style.transform = `
        translate3d(${currentX}px, ${currentY}px, 0)
        rotateX(${currentRotateX}deg)
        rotateY(${currentRotateY}deg)
      `;

      requestAnimationFrame(animate);
    };

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);
    animate();

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [rotation, movement, smoothness]);

  return elementRef;
}

