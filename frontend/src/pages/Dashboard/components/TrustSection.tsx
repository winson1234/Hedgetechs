import React from 'react';

const TrustSection: React.FC = () => {
  return (
    <section className="trust-section" id="about">
      <div className="container">
        <div className="section-header" data-gsap-animate="luxe-fade-up" data-gsap-duration="0.4">
          <h2 className="section-title" data-gsap-animate="luxe-fade-up" data-gsap-delay="0.05" data-gsap-duration="0.4">
            We are the most trusted<br />cryptocurrency platform.
          </h2>
          <p className="section-subtitle">
            There are a few reasons why you should choose KrypitalX as your cryptocurrency platform
          </p>
        </div>

        <div className="trust-grid">
          <div className="trust-card card-3d" data-gsap-animate="luxe-fade-up" data-gsap-duration="0.2" data-gsap-stagger="0.03">
            <div className="trust-card-icon" style={{ background: 'linear-gradient(135deg, #ff6b00, #ff9500)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
            </div>
            <h3 className="trust-card-title">Clarity</h3>
            <p className="trust-card-desc">
              We help you make sense of the coins, the terms, the dense charts and market changes.
            </p>
          </div>

          <div className="trust-card card-3d" data-gsap-animate="luxe-fade-up" data-gsap-duration="0.2" data-gsap-stagger="0.03">
            <div className="trust-card-icon" style={{ background: 'linear-gradient(135deg, #00d4aa, #00f5cc)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <path d="M9 12l2 2 4-4"></path>
              </svg>
            </div>
            <h3 className="trust-card-title">Confidence</h3>
            <p className="trust-card-desc">
              Our markets are always up to date, sparking curiosity with real words from real traders.
            </p>
          </div>

          <div className="trust-card card-3d" data-gsap-animate="luxe-fade-up" data-gsap-duration="0.2" data-gsap-stagger="0.03">
            <div className="trust-card-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h3 className="trust-card-title">Community</h3>
            <p className="trust-card-desc">
              We support the crypto community, putting data in the hands which need it most.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;