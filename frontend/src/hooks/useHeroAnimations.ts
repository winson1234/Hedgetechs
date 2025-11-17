import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Premium Hero Image Animations Hook
 * Combines all hero animations: floating, parallax, entrance, glow
 */
export function useHeroAnimations() {
  const heroImageRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!heroImageRef.current || !heroImgRef.current) return;

    const heroImage = heroImageRef.current;
    const heroImg = heroImgRef.current;

    // 1. Entrance Animation (Fade + Scale)
    gsap.set(heroImg, {
      opacity: 0,
      scale: 0.95,
    });

    const entranceTl = gsap.timeline({
      scrollTrigger: {
        trigger: heroImage,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });

    entranceTl.to(heroImg, {
      opacity: 1,
      scale: 1,
      duration: 1.2,
      ease: 'power3.out',
    });

    // 2. Scroll Parallax (Subtle movement on scroll)
    gsap.to(heroImg, {
      y: () => ScrollTrigger.maxScroll(window) * 0.1, // 10% of scroll distance
      ease: 'none',
      scrollTrigger: {
        trigger: heroImage,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1,
      },
    });

    // 3. Floating Animation for Stacked Cards (2-6px up/down)
    if (cardsRef.current) {
      gsap.to(cardsRef.current, {
        y: '+=4',
        duration: 3,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    }

    // 4. Floating Drift for Circular Crypto Icons (Random, slow)
    iconsRef.current.forEach((icon) => {
      if (!icon) return;
      
      const randomX = (Math.random() - 0.5) * 8; // -4px to 4px
      const randomY = (Math.random() - 0.5) * 8;
      const randomDuration = 4 + Math.random() * 2; // 4-6 seconds
      const randomDelay = Math.random() * 2;

      gsap.to(icon, {
        x: `+=${randomX}`,
        y: `+=${randomY}`,
        duration: randomDuration,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: randomDelay,
      });
    });

    // 5. Soft Glow Pulse for Neon Edges
    const glowElements = heroImage.querySelectorAll('[data-glow]');
    glowElements.forEach((element) => {
      gsap.to(element, {
        opacity: 0.6,
        duration: 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    });

    // Cleanup
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.vars.trigger === heroImage) {
          trigger.kill();
        }
      });
    };
  }, []);

  return {
    heroImageRef,
    heroImgRef,
    cardsRef,
    iconsRef,
  };
}

