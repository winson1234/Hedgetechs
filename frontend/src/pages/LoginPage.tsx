import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../store';
import { signIn } from '../store/slices/authSlice';
import './login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const candlesticksRef = useRef<HTMLDivElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Scroll to top on mount and when location changes
  useEffect(() => {
    // Use setTimeout to ensure DOM is ready
    const scrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    // Immediate scroll
    scrollToTop();

    // Also try after a short delay to ensure it works
    setTimeout(scrollToTop, 0);
    setTimeout(scrollToTop, 10);
    setTimeout(scrollToTop, 50);
  }, [location.pathname]);

  // Generate candlesticks on mount (matching original main.js)
  useEffect(() => {
    if (candlesticksRef.current) {
      const container = candlesticksRef.current;
      const numCandles = 60;
      for (let i = 0; i < numCandles; i++) {
        const candle = document.createElement('div');
        candle.className = 'candlestick';
        const height = Math.random() * 100 + 30;
        const left = (i / numCandles) * 100;
        const bottom = Math.random() * 40 + 10;
        candle.style.height = `${height}px`;
        candle.style.left = `${left}%`;
        candle.style.bottom = `${bottom}%`;
        container.appendChild(candle);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await dispatch(signIn({ email: email.trim().toLowerCase(), password })).unwrap();
      navigate('/trading');
    } catch (error) {
      alert('❌ Incorrect email or password.');
    }
  };

  return (
    <div className="login-page">
      <div className="container">
        <div className="background"></div>

        <div className="login-card">
          <div className="logo">
            <img src="/new-02.png" alt="Hedgetech.co" className="logo-image-login" />
          </div>
          <p className="subtitle">Sign in to Secure Client Area</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Your email address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

         <div className="form-group">
  <label className="form-label">Password</label>
  <div className="input-wrapper">
    <input
      type={showPassword ? 'text' : 'password'}
      className="form-input"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      required
    />

    {/* Eye Icon */}
    <svg
      className="eye-icon"
      onClick={() => setShowPassword(!showPassword)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {showPassword ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </>
      )}
    </svg>
  </div>

  <div className="forgot-password">
    <Link to="/forgot-password">Forgot Password?</Link>
  </div>
</div>

<button type="submit" className="login-button">Login</button>

          </form>

          <div className="signup-section">
            <p className="signup-text">Don&apos;t have an account?</p>
            <div className="signup-links">
              <Link to="/register" className='demo-signup-btn'>Open a Demo Account</Link>
              <Link to="/register" className='real-signup-btn'>Open a Real Account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
