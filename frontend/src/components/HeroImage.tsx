import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useCursorParallax } from '../hooks/useCursorParallax';
import { useFloatingAnimation } from '../hooks/useFloatingAnimation';
import { useGlowPulse } from '../hooks/useGlowPulse';
import { useHeroScrollParallax } from '../hooks/useHeroScrollParallax';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface HeroImageProps {
  imageSrc: string;
  imageAlt?: string;
}

/**
 * Premium Hero Image Component
 * Combines all animations: cursor parallax, floating, scroll parallax, entrance, glow
 */
export default function HeroImage({ 
  imageSrc, 
  imageAlt = 'Cryptocurrency Illustration' 
}: HeroImageProps) {
  // Cursor parallax for main container
  const heroImageParallaxRef = useCursorParallax<HTMLDivElement>({
    rotation: 2, // 1-3 degrees
    movement: 3, // 1-3px movement
    smoothness: 0.1,
  });

  // Floating animation for stacked cards
  const heroCardsFloatRef = useFloatingAnimation<HTMLDivElement>({
    distance: 4, // 2-6px
    duration: 3,
    randomize: false,
  });

  // Glow pulse overlay
  const heroGlowRef = useGlowPulse<HTMLDivElement>({
    minOpacity: 0.5,
    maxOpacity: 0.9,
    duration: 2,
  });

  // Scroll parallax for hero image
  const heroImgParallaxRef = useHeroScrollParallax<HTMLImageElement>(0.1);

  // Floating animations for crypto icons
  const btcFloatRef = useFloatingAnimation<HTMLDivElement>({
    distance: 5,
    duration: 4,
    randomize: true,
  });

  const ethFloatRef = useFloatingAnimation<HTMLDivElement>({
    distance: 6,
    duration: 5,
    randomize: true,
  });

  // Entrance animation
  const heroImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const heroImg = heroImgRef.current;
    if (!heroImg) return;

    // Entrance fade + scale
    gsap.set(heroImg, {
      opacity: 0,
      scale: 0.95,
    });

    const entranceTl = gsap.timeline({
      scrollTrigger: {
        trigger: heroImg.closest('.hero-image'),
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

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.vars.trigger === heroImg.closest('.hero-image')) {
          trigger.kill();
        }
      });
    };
  }, []);

  return (
    <div 
      className="hero-image" 
      ref={heroImageParallaxRef}
    >
      {/* Floating Crypto Icons */}
      <div 
        className="coin btc" 
        data-parallax 
        data-parallax-speed="0.03" 
        data-parallax-rotation="0.3" 
        data-gsap-animate="fade-up" 
        data-gsap-delay="0.4"
        ref={btcFloatRef}
      >
        ₿
      </div>
      <div 
        className="coin eth" 
        data-parallax 
        data-parallax-speed="0.02" 
        data-parallax-rotation="-0.2" 
        data-gsap-animate="fade-up" 
        data-gsap-delay="0.5"
        ref={ethFloatRef}
      >
        Ξ
      </div>
      
      {/* Stacked Cards Container - Floating Animation */}
      <div 
        className="hero-img-box" 
        data-gsap-animate="scale-in" 
        data-gsap-delay="0.3"
        ref={heroCardsFloatRef}
      ></div>
      
      {/* Glow Pulse Overlay */}
      <div 
        className="hero-glow-overlay"
        ref={heroGlowRef}
        data-glow
      ></div>
      
      {/* Main Hero Image */}
      <img 
        src={imageSrc}
        alt={imageAlt}
        className="hero-img" 
        data-gsap-animate="fade-up" 
        data-gsap-delay="0.2"
        ref={(el) => {
          if (heroImgRef.current !== el) {
            // @ts-expect-error - assigning to readonly ref for initialization
            heroImgRef.current = el;
          }
          if (el && heroImgParallaxRef.current !== el) {
            // @ts-expect-error - assigning to readonly ref for animation
            heroImgParallaxRef.current = el;
          }
        }}
      />
    </div>
  );
}

