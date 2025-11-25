import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../store';
import { useCursorParallax } from '../../../hooks/useCursorParallax';
import { useFloatingAnimation } from '../../../hooks/useFloatingAnimation';
import { useGlowPulse } from '../../../hooks/useGlowPulse';
import { validateEmail } from '../utils/validation';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import MetricsCounter from '../../../components/MetrixCounter'; // ✅ Import here

const Hero: React.FC = () => {
  const navigate = useNavigate();
  const isLoggedIn = useAppSelector(state => !!state.auth.token);
  
  const [heroEmail, setHeroEmail] = useState('');
  const [heroEmailError, setHeroEmailError] = useState('');

  // Animation refs
  const heroImageParallaxRef = useCursorParallax<HTMLDivElement>({
    rotation: 2,
    movement: 3,
    smoothness: 0.1,
  });

  const heroCardsFloatRef = useFloatingAnimation<HTMLDivElement>({
    distance: 4,
    duration: 3,
    randomize: false,
  });

  const heroGlowRef = useGlowPulse<HTMLDivElement>({
    minOpacity: 0.5,
    maxOpacity: 0.9,
    duration: 2,
  });

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

  const heroImgRef = useRef<HTMLImageElement>(null);

  // Entrance animation for hero image
  useEffect(() => {
    const heroImg = heroImgRef.current;
    if (!heroImg) return;

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

  const handleHeroEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validateEmail(heroEmail);
    if (error) {
      setHeroEmailError(error);
      return;
    }
    
    setHeroEmailError('');
    navigate(`/register?email=${encodeURIComponent(heroEmail)}`);
  };

  return (
    <section className="hero" id="home">
      <div className="container hero-container">
        <div className="hero-content">
          {/* Trust Badge */}
          <div className="hero-badge" data-scroll-animate="fade-down" data-scroll-delay="0">
            <span className="badge-icon">✓</span>
            Trusted by 20M+ traders worldwide
          </div>

          {/* Main Heading */}
          <h1 className="hero-title" data-scroll-animate="fade-up" data-scroll-delay="100">
            A trusted and secure<br />cryptocurrency exchange.
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle" data-scroll-animate="fade-up" data-scroll-delay="200">
            Your guide to the world of an open financial system. Get started with the easiest and most secure platform to buy and trade cryptocurrency.
          </p>

          {/* CTA Section - Only show for unlogged users */}
          {!isLoggedIn && (
            <form className="hero-cta" data-scroll-animate="fade-up" data-scroll-delay="300" onSubmit={handleHeroEmailSubmit}>
              <div className="email-input-wrapper">
                <input 
                  type="email" 
                  className={`email-input ${heroEmailError ? 'error' : ''}`}
                  placeholder="Enter your email address" 
                  value={heroEmail}
                  onChange={(e) => {
                    setHeroEmail(e.target.value);
                    if (heroEmailError) setHeroEmailError('');
                  }}
                />
                {heroEmailError && <span className="email-error-message">{heroEmailError}</span>}
              </div>
              <button type="submit" className="btn btn-gradient btn-large">Get Started</button>
            </form>
          )}

          {/* Trust Badges */}
          <div className="trust-badges" data-scroll-animate="fade-up" data-scroll-delay="400">
            <div className="trust-item" data-scroll-animate="scale-in" data-scroll-delay="500">
              <div className="trust-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div className="trust-text">
                <span className="trust-label">Security</span>
                <span className="trust-value">Bank-Level</span>
              </div>
            </div>

            <div className="trust-item" data-scroll-animate="scale-in" data-scroll-delay="600">
              <div className="trust-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div className="trust-text">
                <span className="trust-label">Trading</span>
                <span className="trust-value">24/7</span>
              </div>
            </div>

            <div className="trust-item" data-scroll-animate="scale-in" data-scroll-delay="700">
              <div className="trust-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <line x1="23" y1="21" x2="23" y2="15"></line>
                  <line x1="17" y1="18" x2="23" y2="18"></line>
                </svg>
              </div>
              <div className="trust-text">
                <span className="trust-label">Support</span>
                <span className="trust-value">Expert</span>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className="hero-image" ref={heroImageParallaxRef}>
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
          
          {/* Stacked Cards Container */}
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
            src="/assets/images/upscalemedia-transformed.png" 
            alt="Cryptocurrency Illustration" 
            className="hero-img" 
            data-gsap-animate="fade-up" 
            data-gsap-delay="0.2"
            ref={heroImgRef}
          />
        </div>
      </div>

      {/* ✅ MetricsCounter NOW INSIDE Hero Section */}
      <MetricsCounter />
    </section>
  );
};

export default Hero;