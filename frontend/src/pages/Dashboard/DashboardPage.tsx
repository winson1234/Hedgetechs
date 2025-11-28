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

  // Initialize scroll animations (now using IntersectionObserver)
  useGSAPScrollAnimations();
  useMicroParallax();
  useScrollAnimations({
    threshold: 0.1,
    rootMargin: '0px',
    parallaxSpeed: 0,
  });

  // ✅ Force animations to show when section becomes active
  useEffect(() => {
    const activeSection = document.querySelector('.section-active');
    if (!activeSection) return;

    // Small delay to ensure section transition is complete
    const timer = setTimeout(() => {
      // Find all animated elements in the active section
      const animatedElements = activeSection.querySelectorAll(
        '[data-gsap-animate], [data-scroll-animate], .crypto-table, .news-grid, .market-tabs, .trust-grid, .faq-container'
      );

      animatedElements.forEach((el, index) => {
        // Trigger animation with stagger
        setTimeout(() => {
          el.classList.add('animate-in', 'is-visible');
          
          // Use GSAP for smooth animation
          gsap.fromTo(
            el,
            { opacity: 0, y: 20 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: 'power2.out',
            }
          );
        }, index * 50); // Stagger by 50ms
      });
    }, 300); // Wait for section transition

    return () => clearTimeout(timer);
  }, [currentSection]);

  // Intersection Observer for header background
  useEffect(() => {
    const header = document.querySelector("header.header");
    const homeSection = document.querySelector<HTMLElement>("#home");

    if (!header || !homeSection) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          header.classList.remove("scrolled");
        } else {
          header.classList.add("scrolled");
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(homeSection);
    return () => observer.disconnect();
  }, []);

  // Apply theme
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);

    return () => {
      document.body.classList.remove('dark-mode', 'light-mode');
    };
  }, [isDarkMode]);

  const toggleTheme = () => {
    dispatch(setTheme(isDarkMode ? 'light' : 'dark'));
  };

  return (
    <>
      <div className="dashboard-page">
        <Header 
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          activeSectionId={sections[currentSection]?.id}
          scrollToSection={scrollToSection}
        />

        <Hero />
        <MarketSection isDarkMode={isDarkMode} />
        <NewsSection isDarkMode={isDarkMode} />
        <PayoutSection />
        <FeaturesSection />
        <TrustSection />
        <FAQSection />
        <Footer isDarkMode={isDarkMode} />

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