import { useEffect, useRef, useState } from "react";

interface Stat {
  value: number;
  suffix: string;
  label: string;
  prefix?: string;
}

const StatsBanner: React.FC = () => {
  const statsRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  const stats: Stat[] = [
    { value: 2.5, suffix: "B+", label: "24h Trading Volume", prefix: "$" },
    { value: 20, suffix: "M+", label: "Active Traders" },
    { value: 198, suffix: "+", label: "Countries" },
    { value: 350, suffix: "+", label: "Trading Pairs" },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="stats-section" ref={statsRef}>
      <div className="stats-banner">
        {stats.map((stat, index) => (
          <StatItem
            key={index}
            targetValue={stat.value}
            label={stat.label}
            suffix={stat.suffix}
            prefix={stat.prefix || ""}
            visible={visible}
            delay={index * 150}
          />
        ))}
      </div>
    </section>
  );
};

interface StatItemProps {
  targetValue: number;
  label: string;
  suffix: string;
  prefix: string;
  visible: boolean;
  delay: number;
}

const easeOutQuad = (t: number) => t * (2 - t); // easing function

/* eslint-disable react/prop-types */
const StatItem: React.FC<StatItemProps> = ({
  targetValue,
  label,
  suffix,
  prefix,
  visible,
  delay,
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;

    let startTime: number | null = null;
    const duration = 2000;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuad(progress);
      setCount(parseFloat((targetValue * easedProgress).toFixed(2)));
      if (progress < 1) requestAnimationFrame(animate);
    };

    const timer = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(timer);
  }, [visible, targetValue]);

  return (
    <div
      className={`stat-item ${visible ? "visible" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="stat-value">
        {prefix}
        {count.toFixed(targetValue < 10 ? 1 : 0)}
        {suffix}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
};

export default StatsBanner;
