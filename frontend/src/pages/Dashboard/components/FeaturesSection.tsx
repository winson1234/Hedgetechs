import React from 'react';

const FeaturesSection: React.FC = () => {
  return (
    <section className="features-section" id="features">
      <div className="container">
        <div className="features-container">
          {/* Left Side - Content */}
          <div className="features-content">
            <h2 
              className="features-main-title" 
              data-gsap-animate="fade-up-3d" 
              data-gsap-delay="0.1"
              style={{ transformOrigin: 'left center' }}
            >
              The most trusted cryptocurrency platform.
            </h2>

            <p 
              className="features-main-desc" 
              data-gsap-animate="fade-up-3d" 
              data-gsap-delay="0.2"
              style={{ transformOrigin: 'left center' }}
            >
              KrypitalX has a variety of features that make it the best place to start trading.
            </p>

            <div className="features-list">
              <div className="feature-item" data-gsap-animate="card-slide-3d" data-gsap-delay="0.3">
                <div className="feature-item-icon" style={{ background: 'linear-gradient(135deg, #ff6b00, #ff9500)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="4"></circle>
                    <line x1="21.17" y1="8" x2="12" y2="8"></line>
                    <line x1="3.95" y1="6.06" x2="8.54" y2="14"></line>
                    <line x1="10.88" y1="21.94" x2="15.46" y2="14"></line>
                  </svg>
                </div>
                <div className="feature-item-text">
                  <h3 className="feature-item-title">Portfolio Manager</h3>
                  <p className="feature-item-desc">Buy and sell popular digital currencies, keep track of them in one place.</p>
                </div>
              </div>

              <div className="feature-item" data-gsap-animate="card-slide-3d" data-gsap-delay="0.4">
                <div className="feature-item-icon" style={{ background: 'linear-gradient(135deg, #00d4aa, #00f5cc)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <path d="M9 12l2 2 4-4"></path>
                  </svg>
                </div>
                <div className="feature-item-text">
                  <h3 className="feature-item-title">Vault Protection</h3>
                  <p className="feature-item-desc">For added security, store your funds in a vault with time delayed withdrawals.</p>
                </div>
              </div>

              <div className="feature-item" data-gsap-animate="card-slide-3d" data-gsap-delay="0.5">
                <div className="feature-item-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #c084fc)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                </div>
                <div className="feature-item-text">
                  <h3 className="feature-item-title">Mobile Apps</h3>
                  <p className="feature-item-desc">Stay on top of the markets with the KrypitalX app for Android or iOS.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Dashboard Image */}
          <div className="features-image">
            <img 
              src="assets/images/upscalemedia-transformed_11zon (1).webp" 
              alt="Trading Dashboard" 
              className="dashboard-img" 
              data-gsap-animate="image-reveal-3d" 
              data-gsap-delay="0.2"
              style={{ transformOrigin: 'center center' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;