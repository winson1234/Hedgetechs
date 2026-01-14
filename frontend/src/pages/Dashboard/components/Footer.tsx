import React from 'react';

// ✅ Add interface with isDarkMode prop
interface FooterProps {
  isDarkMode: boolean;
}

// ✅ Update component to accept props
const Footer: React.FC<FooterProps> = ({ isDarkMode }) => {
  return (
    <footer className="footer" id="footer">
      {/* Support CTA Section */}
      <div className="footer-support-cta" style={{
        padding: '4rem 0',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div className="container">
          <div className="faq-footer">
            <h3 className="faq-footer-title">Still have questions?</h3>
            <p className="faq-footer-text">Our support team is here to help you 24/7</p>
            <div className="faq-cta-buttons">
              <button className="btn btn-gradient">Contact Support</button>
              <button className="btn btn-secondary">Visit Help Center</button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Content */}
      <div className="container" style={{ paddingTop: '3rem' }}>
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              {/* ✅ Dynamic logo based on theme */}
              <img
                src={isDarkMode ? "/new-02" : "/new-02.png"}
                alt="Hedgetechs.co"
                className="logo-image"
              />
            </div>
            <p className="footer-tagline">The most trusted cryptocurrency exchange platform.</p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Products</h4>
              <a href="#">Exchange</a>
              <a href="#">Wallet</a>
              <a href="#">Explorer</a>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Careers</a>
              <a href="#">Blog</a>
            </div>
            <div className="footer-column">
              <h4>Support</h4>
              <a href="#">Help Center</a>
              <a href="#">Contact</a>
              <a href="#">Status</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Hedgetechs. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;