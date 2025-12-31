import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiUrl } from '../utils/api';
import './forgotpassword.css';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError('');
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/v1/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // We don't check for 404 to avoid user enumeration security risks
      // Always show success even if email not found (standard practice)
      // But we can check for server errors
      if (response.status >= 500) {
        setEmailError('Server error. Please try again later.');
        return;
      }

      setStep('success');
    } catch (error) {
      console.error('Error:', error);
      setEmailError('Failed to connect to server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgotpassword-page">
      <div className="header">
        <Link to="/trading" className="logo">
          <img src="/new-02.png" alt="Hedgetechs" className="logo-image-header" />
        </Link>
        <Link to="/login">
          <button className="client-login-btn">Client Login</button>
        </Link>
      </div>

      <div className="background"></div>

      <div className="container">
        <div className="card">
          {step === 'email' ? (
            <>
              <h1>Reset Password</h1>
              <p className="description">Enter your email address to receive a secure link to reset your password.</p>

              <form onSubmit={handleEmailSubmit}>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    autoFocus
                  />
                  {emailError && <div className="error-message show">{emailError}</div>}
                </div>
                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isLoading ? 'Sending Link...' : 'Send Reset Link'}
                </button>
              </form>
              <Link to="/login" className="back-link">← Back to Login</Link>
            </>
          ) : (
            <div className="success-content">
              <div className="icon-circle">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mail-icon">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                </svg>
              </div>
              <h1>Check your email</h1>
              <p className="description">
                We have sent a password reset link to <br />
                <strong>{email}</strong>
              </p>

              <div className="action-buttons">
                <button className="submit-btn" onClick={() => setStep('email')}>
                  Click to resend
                </button>
              </div>

              <p className="footer-text">
                Did not receive the email? Check your spam folder or <Link to="/contact">contact support</Link>.
              </p>

              <Link to="/login" className="back-link">Back to Login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
