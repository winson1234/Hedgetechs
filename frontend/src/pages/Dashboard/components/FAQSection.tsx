import React, { useState } from 'react';
import { FAQ_ITEMS } from '../constants/dashboard';

const FAQSection: React.FC = () => {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  return (
    <section className="faq-section" id="faq">
      <div className="container">
        {/* Section Header */}
        <div className="section-header" data-gsap-animate="fade-up" data-gsap-duration="1.2">
          <h2 className="section-title" data-gsap-animate="fade-up" data-gsap-delay="0.1">
            Frequently Asked Questions
          </h2>
          <p className="section-subtitle">
            Find answers to common questions about trading, accounts, and support
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="faq-container" data-gsap-stagger-container="0.08">
          {FAQ_ITEMS.map((faq, index) => (
            <div 
              key={index} 
              className={`faq-item ${expandedFAQ === index ? 'active' : ''}`}
              data-gsap-animate="fade-up"
              data-gsap-duration="0.35"
              data-gsap-stagger={index}
            >
              <button
                className="faq-question"
                onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                aria-expanded={expandedFAQ === index}
              >
                <span className="question-text">{faq.question}</span>
                <span className="faq-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </span>
              </button>
              <div className="faq-answer">
                <div className="answer-content">
                  <p>{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;