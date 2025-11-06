import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import './register.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const register = useAuthStore(state => state.register);

  const [formData, setFormData] = useState({
    country: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    retypePassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showRetypePassword, setShowRetypePassword] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [retypeError, setRetypeError] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, text: '', color: '' });

  const passwordRef = useRef<HTMLInputElement>(null);
  const retypePasswordRef = useRef<HTMLInputElement>(null);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  // Password strength checker
  useEffect(() => {
    if (!formData.password) {
      setPasswordStrength({ level: 0, text: '', color: '' });
      return;
    }

    let strength = 0;
    if (formData.password.length >= 8) strength++;
    if (formData.password.length >= 12) strength++;
    if (/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password)) strength++;
    if (/\d/.test(formData.password)) strength++;
    if (/[^a-zA-Z\d]/.test(formData.password)) strength++;

    const levels = [
      { text: '', color: '' },
      { text: 'Weak', color: '#e74c3c' },
      { text: 'Fair', color: '#f39c12' },
      { text: 'Good', color: '#27ae60' },
      { text: 'Strong', color: '#27ae60' },
      { text: 'Very Strong', color: '#27ae60' }
    ];

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

    if (!formData.email.includes('@')) {
      setEmailError(true);
      return;
    }
    setEmailError(false);

    if (formData.password !== formData.retypePassword) {
      setRetypeError(true);
      return;
    }

    if (formData.password.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    const result = await register({
      name: `${formData.firstName} ${formData.lastName}`,
      email: formData.email,
      country: formData.country,
      password: formData.password
    });

    if (result.success) {
      // Logout after registration to require login with new credentials
      useAuthStore.getState().logout();
      alert('Registration successful! Please login with your credentials.');
      navigate('/login');
    } else {
      alert(result.message || 'Registration failed');
    }
  };

  return (
    <div className="register-page">
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
          <h1>Create Account</h1>
          <p>Join FP Markets and start trading today</p>

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

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password <span className="required">*</span></label>
              <div className="password-wrapper">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
<<<<<<< HEAD
                  placeholder="Enter your password"
=======
>>>>>>> e7427abedf3263e24b659f5b923224dbbbf0e312
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
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
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
<<<<<<< HEAD
                  placeholder="Re-enter your password"
=======
>>>>>>> e7427abedf3263e24b659f5b923224dbbbf0e312
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
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </>
                  )}
                </svg>
              </div>
              {retypeError && <div className="error-message show">Passwords do not match</div>}
            </div>

            <button type="submit" id="registerBtn">Create Account</button>

            <p className="terms-text">
              By creating an account, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
            </p>

            <Link to="/login" className="signin-link">Already have an account? Sign in</Link>
          </form>
        </div>
      </div>
    </div>
  );
}
