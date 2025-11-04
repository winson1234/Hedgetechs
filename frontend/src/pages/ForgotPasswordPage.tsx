import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './forgotpassword.css';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'otp' | 'password' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, text: '', color: '' });

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  // Password strength calculator
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength({ level: 0, text: '', color: '' });
      return;
    }

    let strength = 0;
    if (newPassword.length >= 8) strength++;
    if (newPassword.length >= 12) strength++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) strength++;
    if (/\d/.test(newPassword)) strength++;
    if (/[^a-zA-Z\d]/.test(newPassword)) strength++;

    const levels = [
      { text: '', color: '' },
      { text: 'Weak', color: '#e74c3c' },
      { text: 'Fair', color: '#f39c12' },
      { text: 'Good', color: '#27ae60' },
      { text: 'Strong', color: '#27ae60' },
      { text: 'Very Strong', color: '#27ae60' }
    ];

    setPasswordStrength({ level: strength, ...levels[strength] });
  }, [newPassword]);

  const handleEmailSubmit = () => {
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    // In real app, would send OTP to email
    setStep('otp');
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // Only allow single digits

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOtp = () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setConfirmError('Please enter all 6 digits');
      return;
    }
    // In real app, would verify OTP with backend
    setConfirmError('');
    setStep('password');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      return;
    }
    setConfirmError('');

    // In real app, would update password on backend
    setStep('success');
  };

  return (
    <div className="forgotpassword-page">
      <div className="header">
        <div className="logo">
          <span className="fp">FP</span><span className="markets">Markets</span>
        </div>
        <Link to="/login">
          <button className="client-login-btn">Client Login</button>
        </Link>
      </div>

      <div className="background"></div>

      <div className="container">
        <div className="card">
          <h1>Reset Password</h1>
          <p id="cardDescription">
            {step === 'email' && 'Enter your email address to reset your password'}
            {step === 'otp' && 'Enter the 6-digit OTP sent to your email'}
            {step === 'password' && 'Create a new password for your account'}
            {step === 'success' && ''}
          </p>

          {/* OTP Section */}
          {step === 'otp' && (
            <div className="otp-section">
              <div className="otp-inputs">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    maxLength={1}
                    className="otp-digit"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  />
                ))}
              </div>
              <button id="verifyOtpBtn" onClick={handleVerifyOtp}>Verify OTP</button>
              {confirmError && <div className="error-message show">{confirmError}</div>}
            </div>
          )}

          {/* Success Banner */}
          {step === 'success' && (
            <div className="success-banner show">
              ✅ Password updated successfully! You can now log in with your new password.
            </div>
          )}

          <form id="resetForm" onSubmit={handlePasswordSubmit}>
            {/* Email Section */}
            {step === 'email' && (
              <div id="emailSection">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  {emailError && <div className="error-message show">{emailError}</div>}
                </div>
                <button type="button" id="verifyEmailBtn" onClick={handleEmailSubmit}>Continue</button>
              </div>
            )}

            {/* Password Section */}
            {step === 'password' && (
              <div id="passwordSection" className="password-section show">
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  {passwordError && <div className="error-message show">{passwordError}</div>}
                  {newPassword && (
                    <div className="password-strength">
                      <div className="strength-bar">
                        <div
                          className="strength-bar-fill"
                          style={{
                            width: `${(passwordStrength.level / 5) * 100}%`,
                            backgroundColor: passwordStrength.color
                          }}
                        ></div>
                      </div>
                      <div className="strength-text" style={{ color: passwordStrength.color }}>
                        {passwordStrength.text}
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  {confirmError && <div className="error-message show">{confirmError}</div>}
                </div>

                <button type="submit" id="submitBtn">Reset Password</button>
              </div>
            )}
          </form>

          <Link to="/login" className="signin-link">Sign in now</Link>
        </div>
      </div>
    </div>
  );
}
