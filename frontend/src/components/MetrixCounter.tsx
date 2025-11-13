import React, { useState, useEffect, useRef } from 'react';
import '../styles/keystatistics.css';

interface MetricsCounts {
  volume: number;
  traders: number;
  countries: number;
  pairs: number;
}

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

  const targetValues = {
    volume: 2.5,
    traders: 20,
    countries: 198,
    pairs: 350
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            setIsVisible(true);
            hasAnimated.current = true;
            startCountAnimation();
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const startCountAnimation = () => {
    const duration = 3000; // 3 seconds - slower animation
    const fps = 60; // 60 frames per second
    const totalFrames = (duration / 1000) * fps;
    const frameDuration = 1000 / fps;

    let currentFrame = 0;

    const timer = setInterval(() => {
      currentFrame++;
      const progress = currentFrame / totalFrames;
      
      // Smooth easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);

      setCounts({
        volume: Number((targetValues.volume * easeOutQuart).toFixed(1)),
        traders: Math.floor(targetValues.traders * easeOutQuart),
        countries: Math.floor(targetValues.countries * easeOutQuart),
        pairs: Math.floor(targetValues.pairs * easeOutQuart)
      });

      if (currentFrame >= totalFrames) {
        clearInterval(timer);
        setCounts(targetValues);
      }
    }, frameDuration);
  };

  return (
    <section 
      ref={sectionRef}
      className={`metrics-section ${isVisible ? 'visible' : ''}`}
    >
      <div className="metrics-container">
        {/* Metric 1 - Trading Volume */}
        <div className="metric-item">
          <div className="metric-value">
            ${counts.volume.toFixed(1)}B+
          </div>
          <div className="metric-label">
            24h Trading Volume
          </div>
        </div>

        {/* Metric 2 - Active Traders */}
        <div className="metric-item">
          <div className="metric-value">
            {counts.traders}M+
          </div>
          <div className="metric-label">
            Active Traders
          </div>
        </div>

        {/* Metric 3 - Countries */}
        <div className="metric-item">
          <div className="metric-value">
            {counts.countries}+
          </div>
          <div className="metric-label">
            Countries
          </div>
        </div>

        {/* Metric 4 - Trading Pairs */}
        <div className="metric-item">
          <div className="metric-value">
            {counts.pairs}+
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