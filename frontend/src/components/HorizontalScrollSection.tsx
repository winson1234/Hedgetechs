import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface HorizontalScrollSectionProps {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}

/**
 * Premium Horizontal Scroll Section
 * Elegant horizontal scroll activated by vertical scroll input
 * 2026-level premium feel
 */
export default function HorizontalScrollSection({
  children,
  className = '',
  speed = 1,
}: HorizontalScrollSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return;

    const container = containerRef.current;
    const content = contentRef.current;

    // Calculate scroll distance
    const getScrollDistance = () => {
      return content.scrollWidth - container.clientWidth;
    };

    // Create horizontal scroll animation
    const scrollTween = gsap.to(content, {
      x: () => -getScrollDistance(),
      ease: 'none',
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: () => `+=${getScrollDistance() * speed}`,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
      },
    });

    // Update on resize
    const handleResize = () => {
      ScrollTrigger.refresh();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      scrollTween.kill();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.vars.trigger === container) {
          trigger.kill();
        }
      });
      window.removeEventListener('resize', handleResize);
    };
  }, [speed]);

  return (
    <div ref={containerRef} className={`horizontal-scroll-container ${className}`}>
      <div ref={contentRef} className="horizontal-scroll-content">
        {children}
      </div>
    </div>
  );
}

