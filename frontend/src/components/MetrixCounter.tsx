import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/keystatistics.css';

interface MetricsCounts {
  volume: number;
  traders: number;
  countries: number;
  pairs: number;
}

const TARGET_VALUES: MetricsCounts = {
  volume: 2.5,
  traders: 20,
  countries: 198,
  pairs: 350
};

const MetricsCounter: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [counts, setCounts] = useState<MetricsCounts>({
    volume: 0,
    traders: 0,
    countries: 0,
    pairs: 0
  });
  
  const sectionRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);
  const animationRef = useRef<number | null>(null);

  const startCountAnimation = useCallback(() => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    // Reset counts to 0 to ensure animation starts from beginning
    setCounts({
      volume: 0,
      traders: 0,
      countries: 0,
      pairs: 0
    });

    const duration = 5000; // 5 seconds for fast slot machine effect
    const startTime = performance.now();

    // Fast slot machine easing - starts fast, slows down at the end
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3);
    };

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Fast start, slow end for slot machine effect
      const eased = easeOutCubic(progress);

      // Calculate current values with fast animation
      const currentVolume = TARGET_VALUES.volume * eased;
      const currentTraders = TARGET_VALUES.traders * eased;
      const currentCountries = TARGET_VALUES.countries * eased;
      const currentPairs = TARGET_VALUES.pairs * eased;

      setCounts({
        volume: Number(currentVolume.toFixed(1)),
        traders: Math.floor(currentTraders),
        countries: Math.floor(currentCountries),
        pairs: Math.floor(currentPairs)
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure final values are exact
        setCounts(TARGET_VALUES);
        animationRef.current = null;
      }
    };

    // Small delay to ensure visibility is set first
    setTimeout(() => {
      animationRef.current = requestAnimationFrame(animate);
    }, 200);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            // Small delay to ensure element is fully visible
            setTimeout(() => {
              setIsVisible(true);
              hasAnimated.current = true;
              startCountAnimation();
            }, 100);
          }
        });
      },
      { 
        threshold: 0.1, // Trigger earlier when 10% visible
        rootMargin: '0px 0px -50px 0px' // Trigger 50px before entering viewport
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [startCountAnimation]);

  return (
    <section 
      ref={sectionRef}
      className={`metrics-section ${isVisible ? 'visible' : ''}`}
    >
      <div className="metrics-container">
        <div className="bubble bubble-1"></div>
        <div className="bubble bubble-2"></div>
        {/* Metric 1 - Trading Volume */}
        <div className="metric-item">
          <div className="metric-value slot-machine">
            <span className="slot-digit">${counts.volume.toFixed(1)}</span>B+
          </div>
          <div className="metric-label">
            24h Trading Volume
          </div>
        </div>

        {/* Metric 2 - Active Traders */}
        <div className="metric-item">
          <div className="metric-value slot-machine">
            <span className="slot-digit">{counts.traders}</span>M+
          </div>
          <div className="metric-label">
            Active Traders
          </div>
        </div>

        {/* Metric 3 - Countries */}
        <div className="metric-item">
          <div className="metric-value slot-machine">
            <span className="slot-digit">{counts.countries}</span>+
          </div>
          <div className="metric-label">
            Countries
          </div>
        </div>

        {/* Metric 4 - Trading Pairs */}
        <div className="metric-item">
          <div className="metric-value slot-machine">
            <span className="slot-digit">{counts.pairs}</span>+
          </div>
          <div className="metric-label">
            Trading Pairs
          </div>
        </div>
      </div>
    </section>
  );
};

export default MetricsCounter;