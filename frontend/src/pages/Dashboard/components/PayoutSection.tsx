import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../store';
import { useExchangeRates } from '../hooks/useExchangeRates'; 
import { PAYOUT_CRYPTOS } from '../constants/dashboard';
import { USD_FORMATTER, CRYPTO_FORMATTER } from '../utils/formatters';

const PayoutSection: React.FC = () => {
  const navigate = useNavigate();
  const isLoggedIn = useAppSelector(state => !!state.auth.token);

  const [selectedCrypto, setSelectedCrypto] = useState<string>(PAYOUT_CRYPTOS[0].symbol);
  const [fiatInput, setFiatInput] = useState('5000');
  const [cryptoMenuOpen, setCryptoMenuOpen] = useState(false);

  const cryptoMenuRef = useRef<HTMLDivElement>(null);
  const cryptoMenuListRef = useRef<HTMLUListElement>(null);
  const cryptoSelectorBtnRef = useRef<HTMLButtonElement>(null);

  const {
    exchangeRates,
    rateLastUpdated,
    rateSource,
    ratesLoading,
    rateError
  } = useExchangeRates();

  const fiatAmount = Number(fiatInput.replace(/[^0-9.]/g, '')) || 0;
  const selectedRate = exchangeRates[selectedCrypto] ?? 0;
  const cryptoAmount = selectedRate > 0 ? fiatAmount / selectedRate : 0;
  const selectedCryptoMeta = PAYOUT_CRYPTOS.find(item => item.symbol === selectedCrypto) ?? PAYOUT_CRYPTOS[0];
  const formattedRate = selectedRate > 0 ? USD_FORMATTER.format(selectedRate) : '—';
  const formattedCryptoAmount = cryptoAmount > 0 ? CRYPTO_FORMATTER.format(cryptoAmount) : '0.0000';
  const lastUpdatedLabel = rateLastUpdated
    ? new Date(rateLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const handleFiatInputChange = (value: string) => {
    const numericOnly = value.replace(/[^0-9.]/g, '');
    const parts = numericOnly.split('.');
    const normalized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : numericOnly;
    setFiatInput(normalized);
  };

  // Close crypto menu when clicking outside
  useEffect(() => {
    if (!cryptoMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (cryptoMenuRef.current && !cryptoMenuRef.current.contains(event.target as Node)) {
        setCryptoMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [cryptoMenuOpen]);

  return (
    <section className="payout-section" id="exchange" data-fade-in-up>
      <div className="container">
        <div className="payout-container" data-gsap-animate="fade-up" data-gsap-delay="0.5">
          {/* Left Side - Trading Card Image */}
          <div className="payout-image">
            <div className="trading-card-mockup">
              <div className="card-header">
                <span className="card-tab active">Buy</span>
                <span className="card-tab">Sell</span>
              </div>
              <div className="card-content">
                <div className="btc-price">
                  <p className="price-label">1 {selectedCrypto} is roughly</p>
                  <h3 className="price-value">
                    {ratesLoading && !lastUpdatedLabel ? 'Loading...' : formattedRate}
                    <span>USD</span>
                  </h3>
                  <p className="price-meta">
                    {rateError
                      ? `Using last known rate • ${rateError}`
                      : `${rateSource === 'live' ? 'Live rate' : 'Cached rate'}${lastUpdatedLabel ? ` • Updated ${lastUpdatedLabel} UTC` : ''}`}
                  </p>
                </div>
                <div className="input-field">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fiatInput}
                    onChange={(event) => handleFiatInputChange(event.target.value)}
                    aria-label="Amount in USD"
                  />
                  <div className="currency-selector">
                    <span className="currency-icon">💵</span>
                    <span>USD</span>
                  </div>
                </div>
                <div className="input-field">
                  <input
                    type="text"
                    value={formattedCryptoAmount}
                    readOnly
                    aria-label={`Estimated ${selectedCrypto} amount`}
                  />
                  <div className="crypto-selector" ref={cryptoMenuRef}>
                    <button
                      ref={cryptoSelectorBtnRef}
                      type="button"
                      className="crypto-selector-btn"
                      onClick={() => setCryptoMenuOpen(!cryptoMenuOpen)}
                      title="Select Cryptocurrency"
                    >
                      <span className="crypto-icon">{selectedCryptoMeta.icon}</span>
                      <span className="crypto-label">{selectedCryptoMeta.label}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>

                    {cryptoMenuOpen && (
                      <ul 
                        ref={cryptoMenuListRef}
                        className="crypto-menu show"
                        onWheel={(e) => {
                          e.stopPropagation();
                          const target = e.currentTarget;
                          const scrollAmount = e.deltaY;
                          target.scrollTop += scrollAmount;
                        }}
                      >
                        {PAYOUT_CRYPTOS.map(crypto => (
                          <li
                            key={crypto.symbol}
                            className={selectedCrypto === crypto.symbol ? 'selected' : ''}
                            onClick={() => {
                              setSelectedCrypto(crypto.symbol);
                              setCryptoMenuOpen(false);
                            }}
                          >
                            <span className="crypto-icon">{crypto.icon}</span>
                            <span>{crypto.label} ({crypto.symbol})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <button 
                  className="buy-now-btn" 
                  disabled={selectedRate === 0}
                  onClick={() => {
                    if (isLoggedIn) {
                      navigate('/trading');
                    } else {
                      window.scrollTo({ top: 0, behavior: 'instant' });
                      navigate('/login');
                    }
                  }}
                >
                  Buy Now
                </button>
                {rateError && (
                  <p className="rate-error" role="status">
                    Showing cached values while we reconnect.
                  </p>
                )}
              </div>
              <div className="visa-card"></div>
            </div>
          </div>

          {/* Right Side - Content */}
          <div className="payout-content">
            <h2 className="payout-title" data-gsap-animate="fade-up" data-gsap-delay="0.1">
              One click, instant payout with credit or debit card.
            </h2>
            <p className="payout-desc" data-gsap-animate="fade-up" data-gsap-delay="0.2">
              Become a crypto owner in minutes using your debit or credit card and quickly purchase top cryptocurrencies.
            </p>

            <div className="payment-methods" data-gsap-animate="fade-up" data-gsap-delay="0.3">
              <p className="payment-label">We accept payment with many methods:</p>
              <div className="payment-icons">
                <div className="payment-icon mastercard" data-gsap-animate="scale-in" data-gsap-delay="0.4">
                  <div className="circle red"></div>
                  <div className="circle yellow"></div>
                </div>
                <div className="payment-icon" data-gsap-animate="scale-in" data-gsap-delay="0.5">VISA</div>
                <div className="payment-icon" data-gsap-animate="scale-in" data-gsap-delay="0.6">Apple Pay</div>
                <div className="payment-icon" data-gsap-animate="scale-in" data-gsap-delay="0.7">Google Pay</div>
                <div className="payment-icon" data-gsap-animate="scale-in" data-gsap-delay="0.8">PayPal</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PayoutSection;