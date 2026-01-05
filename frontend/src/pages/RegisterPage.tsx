import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../store';
import { signUp } from '../store/slices/authSlice';
import './register.css';
//import { motion, AnimatePresence } from 'framer-motion';

const COUNTRY_PREFIXES: Record<string, string> = {
  MY: '+60',
  SG: '+65',
  TH: '+66',
  ID: '+62',
  PH: '+63',
  VN: '+84',
  US: '+1',
  GB: '+44',
  AU: '+61',
};

const COUNTRY_FLAGS: Record<string, string> = {
  MY: '🇲🇾',
  SG: '🇸🇬',
  TH: '🇹🇭',
  ID: '🇮🇩',
  PH: '🇵🇭',
  VN: '🇻🇳',
  US: '🇺🇸',
  GB: '🇬🇧',
  AU: '🇦🇺',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    country: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    retypePassword: '',
    userType: 'trader'
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showRetypePassword, setShowRetypePassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [retypeError, setRetypeError] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, text: '', color: '' });

  const passwordRef = useRef<HTMLInputElement>(null);
  const retypePasswordRef = useRef<HTMLInputElement>(null);

  // Pre-fill email when redirected with query param
  useEffect(() => {
    const emailParam = searchParams.get('email');
    const verificationNeeded = searchParams.get('verification_needed');

    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }));
    }

    if (verificationNeeded === 'true') {
      setIsSuccess(true);
    }
  }, [searchParams]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;

    if (id === 'phoneNumber') {
      let newPhone = value;
      let newCountry = formData.country;

      // Auto-detect Malaysia from local "01..." format
      if (newPhone.startsWith('01')) {
        newPhone = '+60' + newPhone.substring(1);
        newCountry = 'MY';
      }
      // Auto-detect based on country codes
      else {
        if (newPhone.startsWith('+')) {
          for (const [code, prefix] of Object.entries(COUNTRY_PREFIXES)) {
            if (newPhone.startsWith(prefix)) {
              newCountry = code;
              break;
            }
          }
        } else {
          // Check for raw number start (e.g. 60...)
          for (const [code, prefix] of Object.entries(COUNTRY_PREFIXES)) {
            const rawPrefix = prefix.replace('+', '');
            if (newPhone.startsWith(rawPrefix)) {
              newPhone = '+' + newPhone;
              newCountry = code;
              break;
            }
          }
        }
      }

      setFormData(prev => ({ ...prev, [id]: newPhone, country: newCountry }));
    } else if (id === 'country') {
      const newCountry = value;
      let newPhone = formData.phoneNumber;

      const oldCountry = formData.country;
      const oldPrefix = COUNTRY_PREFIXES[oldCountry] || '';
      const newPrefix = COUNTRY_PREFIXES[newCountry] || '';

      if (oldPrefix && newPhone.startsWith(oldPrefix)) {
        newPhone = newPrefix + newPhone.substring(oldPrefix.length);
      } else if (!newPhone) {
        newPhone = newPrefix;
      }

      setFormData(prev => ({ ...prev, [id]: value, phoneNumber: newPhone }));
    } else {
      setFormData(prev => ({ ...prev, [id]: value }));
    }
  };

  useEffect(() => {
    const password = formData.password;
    if (!password) {
      setPasswordStrength({ level: 0, text: '', color: '' });
      return;
    }

    // 1. Strict Minimum Length Check
    if (password.length < 8) {
      setPasswordStrength({ level: 1, text: 'Too Short (Min 8 chars)', color: '#e74c3c' });
      return;
    }

    // 2. Strict Complexity Check
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[@$!%*?&#^+=._-]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setPasswordStrength({
        level: 1,
        text: 'Too Simple — include upper, lower, number & symbol (@!#)',
        color: '#e74c3c'
      });
      return;
    }

    // 3. Score Calculation (If we are here, it matches all basic rules)
    let strength = 3; // Base "Good" for meeting all requirements
    if (password.length >= 12) strength++; // "Strong"
    if (password.length >= 16) strength++; // "Very Strong"

    const levels = [
      { text: '', color: '' },
      { text: 'Weak', color: '#e74c3c' },
      { text: 'Fair', color: '#f39c12' },
      { text: 'Good', color: '#27ae60' },
      { text: 'Strong', color: '#27ae60' },
      { text: 'Very Strong', color: '#27ae60' }
    ];

    // Safe clamp
    if (strength > 5) strength = 5;

    setPasswordStrength({ level: strength, ...levels[strength] });
  }, [formData.password]);

  // Retype password validation
  useEffect(() => {
    if (formData.retypePassword && formData.password !== formData.retypePassword) {
      setRetypeError(true);
    } else {
      setRetypeError(false);
    }
  }, [formData.password, formData.retypePassword]);

  // Focus restoration toggle
  const togglePassword = () => {
    setShowPassword(prev => !prev);
    setTimeout(() => passwordRef.current?.focus(), 0);
  };

  const toggleRetypePassword = () => {
    setShowRetypePassword(prev => !prev);
    setTimeout(() => retypePasswordRef.current?.focus(), 0);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!formData.email.includes('@')) {
      setEmailError(true);
      return;
    }
    setEmailError(false);

    // Check password strength
    const password = formData.password;

    // Must be at least 8 characters
    if (password.length < 8) {
      setServerError('Password must be at least 8 characters');
      return;
    }

    // Must contain at least one uppercase, one lowercase, one number, and one special character
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^+=._-])[A-Za-z\d@$!%*?&#^+=._-]{8,}$/;

    if (!strongPasswordRegex.test(password)) {
      setServerError('Password must contain upper, lower, digit, and special char');
      return;
    }

    if (formData.password !== formData.retypePassword) {
      setRetypeError(true);
      return;
    }

    try {
      setIsLoading(true);
      await dispatch(signUp({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        country: formData.country,
        userType: formData.userType
      })).unwrap();

      // Show success state
      setIsSuccess(true);
    } catch (error) {
      const message = typeof error === 'string' ? error : (error instanceof Error ? error.message : 'Registration failed');
      setServerError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="header">
        <Link to="/trading" className="logo">
          <img src="/new-02.png" alt="Hedgetechs.co" className="logo-image-header" />
        </Link>
        <Link to="/login">
          <button className="client-login-btn">Client Login</button>
        </Link>
      </div>

      <div className="background"></div>

      <div className="container">
        <div className="card">
          {isSuccess ? (
            <div className="success-content" style={{ padding: '20px 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <svg
                  className="checkmark"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 52 52"
                >
                  <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                  <path
                    className="checkmark-check"
                    fill="none"
                    d="M14 27l7 7 16-16"
                  />
                </svg>
              </div>
              <h1 style={{ marginBottom: '15px', color: '#27ae60' }}>Registration Successful!</h1>
              <p style={{ fontSize: '16px', lineHeight: '1.6', color: '#555', marginBottom: '30px' }}>
                We have sent a verification email to<br />
                <strong style={{ color: '#333', fontSize: '18px' }}>{formData.email}</strong>
                <br /><br />
                Please check your inbox and follow the link to verify your account.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                <button onClick={() => navigate('/login')} className="bg-primary hover:bg-primary-dark text-white font-bold py-2 px-4 rounded w-full">
                  Back to Login
                </button>

                <button
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/v1/auth/resend-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: formData.email })
                      });
                      if (response.ok) {
                        alert('Verification email resent successfully!');
                      } else {
                        const data = await response.json();
                        alert('Failed to resend: ' + (data.message || 'Unknown error'));
                      }
                    } catch (e) {
                      alert('Error communicating with server');
                    }
                  }}
                  style={{
                    marginTop: '20px',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '14px',
                    color: '#666',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    width: 'auto',
                    alignSelf: 'center'
                  }}
                  className="hover:text-primary transition-colors focus:outline-none"
                >
                  Resend Verification Email
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1>Create Account</h1>
              <p>Join Hedgetechs and start trading today</p>

              <form id="registerForm" onSubmit={handleSubmit}>
                {/* Country */}
                <div className="form-group">
                  <label className="form-label">Country <span className="required">*</span></label>
                  <select id="country" value={formData.country} onChange={handleChange} required>
                    <option value="">Select your country</option>
                    <option value="MY">Malaysia</option>
                    <option value="SG">Singapore</option>
                    <option value="TH">Thailand</option>
                    <option value="ID">Indonesia</option>
                    <option value="PH">Philippines</option>
                    <option value="VN">Vietnam</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>

                {/* User Type */}
                <div className="form-group">
                  <label className="form-label">I am a <span className="required">*</span></label>
                  <div className="user-type-selector" style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '15px', color: '#333' }}>
                      <input
                        type="radio"
                        name="userType"
                        value="trader"
                        checked={formData.userType === 'trader'}
                        onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
                        style={{ marginRight: '8px', accentColor: '#27ae60', width: '18px', height: '18px' }}
                      />
                      Trader
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '15px', color: '#333' }}>
                      <input
                        type="radio"
                        name="userType"
                        value="agent"
                        checked={formData.userType === 'agent'}
                        onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
                        style={{ marginRight: '8px', accentColor: '#27ae60', width: '18px', height: '18px' }}
                      />
                      Agent (IB)
                    </label>
                  </div>
                </div>

                {/* Names */}
                <div className="form-group name-group">
                  <div className="name-field">
                    <label className="form-label">First Name <span className="required">*</span></label>
                    <input type="text" id="firstName" value={formData.firstName} onChange={handleChange} required />
                  </div>
                  <div className="name-field">
                    <label className="form-label">Last Name <span className="required">*</span></label>
                    <input type="text" id="lastName" value={formData.lastName} onChange={handleChange} required />
                  </div>
                </div>

                {/* Email */}
                <div className="form-group">
                  <label className="form-label">Email Address <span className="required">*</span></label>
                  <input type="email" id="email" value={formData.email} onChange={handleChange} required />
                  {emailError && <div className="error-message show">Please enter a valid email address</div>}
                </div>

                {/* Phone Number */}
                <div className="form-group">
                  <label className="form-label">Phone Number <span className="required">*</span></label>
                  <div className="phone-wrapper">
                    {formData.country && (
                      <span className="flag-display">
                        {COUNTRY_FLAGS[formData.country]}
                      </span>
                    )}
                    <input
                      type="tel"
                      id="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      maxLength={15}
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="form-group">
                  <label className="form-label">Password <span className="required">*</span></label>
                  <div className="password-wrapper">
                    <input
                      ref={passwordRef}
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      placeholder="Enter your password"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      required
                    />
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

                  {formData.password && (
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
                      <span className="strength-text" style={{ color: passwordStrength.color }}>
                        {passwordStrength.text}
                      </span>
                    </div>
                  )}
                </div>

                {/* Retype Password */}
                <div className="form-group">
                  <label className="form-label">Retype Password <span className="required">*</span></label>
                  <div className="password-wrapper">
                    <input
                      ref={retypePasswordRef}
                      type={showRetypePassword ? 'text' : 'password'}
                      id="retypePassword"
                      placeholder="Re-enter your password"
                      value={formData.retypePassword}
                      onChange={handleChange}
                      autoComplete="new-password"
                      required
                    />
                    <svg
                      className="eye-icon"
                      onClick={toggleRetypePassword}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {showRetypePassword ? (
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
                  {retypeError && <div className="error-message show">Passwords do not match</div>}
                </div>

                {serverError && (
                  <div style={{
                    color: '#c0392b',
                    backgroundColor: '#fadbd8',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '15px',
                    fontSize: '13px',
                    textAlign: 'left',
                    fontWeight: '500'
                  }}>
                    {serverError}
                  </div>
                )}

                <button type="submit" id="registerBtn" disabled={isLoading}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>

                <p className="terms-text">
                  By creating an account, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
                </p>

                <Link to="/login" className="signin-link">Already have an account? Sign in</Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
