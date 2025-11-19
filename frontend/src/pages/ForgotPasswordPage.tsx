import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiUrl } from '../utils/api';
import './forgotpassword.css';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp' | 'password' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, text: '', color: '' });
  const [showPassword, setShowPassword] = useState(false);
  const togglePassword = () => setShowPassword((prev) => !prev);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleEmailSubmit = async () => {
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setEmailError('');
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/v1/auth/forgot-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle different error statuses
        if (data.status === 'not_found') {
          setEmailError('No account found with this email address');
        } else if (data.status === 'pending') {
          setEmailError('Your registration is still pending admin approval. Password reset is not available.');
        } else if (data.status === 'rejected') {
          setEmailError('Your registration has been rejected. Password reset is not available. Please contact support.');
        } else {
          setEmailError(data.message || 'An error occurred. Please try again.');
        }
        return;
      }

      // Success - OTP sent
      // For development, display OTP in alert and console
      if (data.otp) {
        console.log('='.repeat(50));
        console.log('🔐 PASSWORD RESET OTP');
        console.log('='.repeat(50));
        console.log(`Email: ${email}`);
        console.log(`OTP Code: ${data.otp}`);
        console.log('='.repeat(50));
        alert(`OTP has been sent!\n\nFor development, your OTP is: ${data.otp}\n\n(Also logged to browser console)`);
      } else {
        alert('OTP has been sent! Check your email or backend console logs.');
      }
      setStep('otp');
    } catch (error) {
      console.error('Error requesting password reset:', error);
      setEmailError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

  const handleVerifyOtp = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      setConfirmError('Please enter all 6 digits');
      return;
    }

    setConfirmError('');
    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/v1/auth/verify-otp'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp: otpValue }),
      });

      const data = await response.json();

      if (!response.ok) {
        setConfirmError(data.message || 'Invalid OTP. Please check and try again.');
        return;
      }

      // Success - OTP verified, store reset token
      setResetToken(data.reset_token);
      setStep('password');
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setConfirmError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
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

    setIsLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/v1/auth/reset-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          reset_token: resetToken,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.message || 'Failed to reset password. Please try again.');
        return;
      }

      // Success - password reset
      setStep('success');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Error resetting password:', error);
      setPasswordError('Failed to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgotpassword-page">
    <div className="header">
    <Link to="/dashboard" className="logo">
      <span className="fp">FP</span><span className="markets">Markets</span>
    </Link>
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
            {step === 'otp' && 'Enter the 6-digit OTP (check console or alert message)'}
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
              <button id="verifyOtpBtn" onClick={handleVerifyOtp} disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify OTP'}
              </button>
              {confirmError && <div className="error-message show">{confirmError}</div>}
            </div>
          )}

          {/* Success Banner */}
          {step === 'success' && (
            <div className="success-banner show">
              ✅ Password updated successfully! Redirecting to login page...
            </div>
          )}

          <form id="resetForm" onSubmit={handlePasswordSubmit}>
            {/* Email Section */}
            {step === 'email' && (
              <div id="emailSection">
                <div className="form-group">
                  <label className="form-label">Enter your email address</label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  {emailError && <div className="error-message show">{emailError}</div>}
                </div>
                <button type="button" id="verifyEmailBtn" onClick={handleEmailSubmit} disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Continue'}
                </button>
              </div>
            )}

         {/* Password Section */}
{step === 'password' && (
  <div id="passwordSection" className="password-section show">
    <div className="form-group">
      <label className="form-label">New Password</label>
      <div className="input-wrapper">
        <input
          type={showPassword ? 'text' : 'password'}
          id="newPassword"
          placeholder="Enter new password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />

        {/* Eye Icon */}
        <svg
          className="eye-icon"
          onClick={togglePassword}
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

      {passwordError && <div className="error-message show">{passwordError}</div>}

      {newPassword && (
        <div className="password-strength show">
          <div className="strength-bar">
            <div
              className="strength-bar-fill"
              style={{
                width: `${(passwordStrength.level / 5) * 100}%`,
                backgroundColor: passwordStrength.color,
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
  <div className="input-wrapper">
    <input
      type={showConfirmPassword ? 'text' : 'password'}
      id="confirmPassword"
      placeholder="Confirm new password"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      autoComplete="new-password"
    />

    {/* Eye Icon */}
    <svg
      className="eye-icon"
      onClick={() => setShowConfirmPassword((prev) => !prev)}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {showConfirmPassword ? (
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

  {confirmError && <div className="error-message show">{confirmError}</div>}
</div>


    <button type="submit" id="submitBtn" disabled={isLoading}>
      {isLoading ? 'Resetting...' : 'Reset Password'}
    </button>
  </div>
)}

          </form>

          <Link to="/login" className="signin-link">Sign in now</Link>
        </div>
      </div>
    </div>
  );
}
