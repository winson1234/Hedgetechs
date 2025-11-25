import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { setTheme, selectIsDarkMode } from '../../store/slices/uiSlice';
import { useSectionScroll } from './hooks/useSectionScroll';
import { useGSAPScrollAnimations } from '../../hooks/useGSAPScrollAnimations';
import { useMicroParallax } from '../../hooks/useMicroParallax';
import { useScrollAnimations } from '../../hooks/useScrollAnimations';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Component imports
import Header from './components/Header';
import Hero from './components/Hero';
import MarketSection from './components/MarketSection';
import NewsSection from './components/NewsSection';
import PayoutSection from './components/PayoutSection';
import FeaturesSection from './components/FeaturesSection';
import TrustSection from './components/TrustSection';
import FAQSection from './components/FAQSection';
import Footer from './components/Footer';
import { ScrollProgressBar } from './components/ScrollProgressBar';
import { SectionNavigationDots } from './components/SectionNavigationDots';
import { SectionIndicator } from './components/SectionIndicator';

// CSS imports
import './dashboard.css';
import '../../styles/color.css';
import '../../styles/scroll-animations.css';
import '../../styles/premium-scroll.css';
import '../../styles/advanced-animations.css';
import '../../styles/news.css';
import '../../styles/crypto.css';
import '../../styles/mobile.css';
import '../../styles/trust.css';
import '../../styles/luxuryanimation.css';
import '../../styles/section-scroll.css';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// ===== HEADER SCROLL HANDLER - MUST BE OUTSIDE COMPONENT =====
if (typeof window !== 'undefined') {
  let headerScrollInitialized = false;
  
  const initHeaderScroll = () => {
    if (headerScrollInitialized) return;
    
    const header = document.querySelector('.header') as HTMLElement;
    if (!header) {
      setTimeout(initHeaderScroll, 100);
      return;
    }
    
    headerScrollInitialized = true;

    // Find the actual scroll container
    const scrollContainer = document.querySelector('.dashboard-page') as HTMLElement;

    const handleHeaderScroll = () => {
      const scrollTop = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY;
            
      if (scrollTop > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    };
    
    handleHeaderScroll();
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleHeaderScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleHeaderScroll, { passive: true });
    }
  };

  // Wait for DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScroll);
  } else {
    setTimeout(initHeaderScroll, 50);
  }
}

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const isDarkMode = useAppSelector(selectIsDarkMode);
  const { currentSection, sections, scrollToSection } = useSectionScroll();

  // Initialize scroll animations
  useGSAPScrollAnimations();
  useMicroParallax();
  useScrollAnimations({
    threshold: 0.1,
    rootMargin: '0px',
    parallaxSpeed: 0,
  });

  // Intersection Observer for header background
  useEffect(() => {
    const header = document.querySelector("header.header");
    const homeSection = document.querySelector<HTMLElement>("#home");

    if (!header || !homeSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Home section visible → transparent
          header.classList.remove("scrolled");
        } else {
          // Home section NOT visible → solid background
          header.classList.add("scrolled");
        }
      },
      {
        threshold: 0.3,  // 30% of home section must be visible
      }
    );

    observer.observe(homeSection);

    return () => observer.disconnect();
  }, []);

  // Apply theme class to body element when theme changes
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);

    return () => {
      document.body.classList.remove('dark-mode');
      document.body.classList.remove('light-mode');
    };
  }, [isDarkMode]);

  const toggleTheme = () => {
    dispatch(setTheme(isDarkMode ? 'light' : 'dark'));
  };

  return (
    <>
      <div className="dashboard-page">
        {/* Header */}
        <Header 
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          activeSectionId={sections[currentSection]?.id}
          scrollToSection={scrollToSection}
        />

        {/* Hero Section */}
        <Hero />
      
        {/* Market Overview Section */}
        <MarketSection isDarkMode={isDarkMode} />

        {/* News Section */}
        <NewsSection isDarkMode={isDarkMode} />

        {/* One Click Payout Section */}
        <PayoutSection />

        {/* Features Section */}
        <FeaturesSection />

        {/* Trust Section */}
        <TrustSection />

        {/* FAQ Section */}
        <FAQSection />

        {/* Footer */}
        <Footer />

        {/* Scroll UI Components */}
        <ScrollProgressBar 
          currentSection={currentSection} 
          totalSections={sections.length} 
        />

        <SectionNavigationDots 
          currentSection={currentSection}
          sections={sections}
          scrollToSection={scrollToSection}
        />

        <SectionIndicator 
          currentSection={currentSection}
          sections={sections}
        />
      </div>
    </>
  );
}