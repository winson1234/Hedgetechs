import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import './login.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore(state => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const candlesticksRef = useRef<HTMLDivElement>(null);

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

    const result = await login(email.trim().toLowerCase(), password);

    if (result.success) {
      navigate('/trading');
    } else {
      alert('❌ Incorrect email or password.');
    }
  };

  return (
    <div className="login-page">
      <div className="container">
        <div className="background"></div>
        <div className="chart-overlay"></div>
        <div className="candlestick-pattern" ref={candlesticksRef}></div>

        <div className="login-card">
          <div className="logo">
            <h1><span className="fp">FP</span><span className="markets">Markets</span></h1>
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
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <div className="forgot-password">
                <Link to="/forgot-password">Forgot Password?</Link>
              </div>
            </div>

            <button type="submit" className="login-button">Login</button>
          </form>

          <div className="signup-section">
            <p className="signup-text">Don&apos;t have an account?</p>
            <div className="signup-links">
              <Link to="/register">Open a Demo Account</Link>
              <span>|</span>
              <Link to="/register">Open a Real Account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
