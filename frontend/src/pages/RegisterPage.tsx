import { useState, useEffect } from 'react';
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

  // Password strength calculator
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

  // Validate retype password
  useEffect(() => {
    if (formData.retypePassword && formData.password !== formData.retypePassword) {
      setRetypeError(true);
    } else {
      setRetypeError(false);
    }
  }, [formData.password, formData.retypePassword]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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
      navigate('/dashboard');
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
                <option value="CN">China</option>
                <option value="JP">Japan</option>
                <option value="KR">South Korea</option>
                <option value="IN">India</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
                <option value="CA">Canada</option>
                <option value="BR">Brazil</option>
                <option value="MX">Mexico</option>
              </select>
            </div>

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

            <div className="form-group">
              <label className="form-label">Email Address <span className="required">*</span></label>
              <input type="email" id="email" value={formData.email} onChange={handleChange} required />
              {emailError && <div className="error-message show">Please enter a valid email address</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Password <span className="required">*</span></label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
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
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
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

            <div className="form-group">
              <label className="form-label">Retype Password <span className="required">*</span></label>
              <div className="password-wrapper">
                <input
                  type={showRetypePassword ? 'text' : 'password'}
                  id="retypePassword"
                  placeholder="••••••••••••"
                  value={formData.retypePassword}
                  onChange={handleChange}
                  required
                />
                <svg
                  className="eye-icon"
                  onClick={() => setShowRetypePassword(!showRetypePassword)}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
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
