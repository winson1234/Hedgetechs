import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './forgotpassword.css';

// Password hashing utility using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'otp' | 'password' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedOtp, setGeneratedOtp] = useState('');
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

    // Check if user exists
    const registeredUsersData = localStorage.getItem('registeredUsers');
    if (!registeredUsersData) {
      setEmailError('No account found with this email address');
      return;
    }

    const registeredUsers = JSON.parse(registeredUsersData);
    if (!registeredUsers[email]) {
      setEmailError('No account found with this email address');
      return;
    }

    setEmailError('');

    // Generate random 6-digit OTP
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(randomOtp);

    // Store OTP in localStorage for persistence
    localStorage.setItem('reset_otp', randomOtp);
    localStorage.setItem('reset_email', email);

    // Log OTP to console for testing (in production, this would be sent via email)
    console.log('='.repeat(50));
    console.log('🔐 PASSWORD RESET OTP');
    console.log('='.repeat(50));
    console.log(`Email: ${email}`);
    console.log(`OTP Code: ${randomOtp}`);
    console.log('='.repeat(50));
    console.log('⚠️ This OTP is valid for this session only');
    console.log('='.repeat(50));

    alert(`OTP has been generated! Check the console (F12) for the OTP code.\n\nOTP: ${randomOtp}`);

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

    // Verify OTP matches generated OTP
    const storedOtp = localStorage.getItem('reset_otp') || generatedOtp;
    if (otpValue !== storedOtp) {
      setConfirmError('Invalid OTP. Please check and try again.');
      return;
    }

    setConfirmError('');
    setStep('password');
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

    try {
      // Get the email from localStorage
      const resetEmail = localStorage.getItem('reset_email') || email;

      // Hash the new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update registered users database
      const registeredUsersData = localStorage.getItem('registeredUsers');
      if (registeredUsersData) {
        const registeredUsers = JSON.parse(registeredUsersData);
        if (registeredUsers[resetEmail]) {
          registeredUsers[resetEmail].passwordHash = newPasswordHash;
          localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));

          // Also update the standalone password hash
          localStorage.setItem(`userPasswordHash_${resetEmail}`, newPasswordHash);

          console.log('✅ Password updated successfully for:', resetEmail);
        }
      }

      // Clear reset data
      localStorage.removeItem('reset_otp');
      localStorage.removeItem('reset_email');

      setStep('success');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError('An error occurred while updating password');
    }
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
              <button id="verifyOtpBtn" onClick={handleVerifyOtp}>Verify OTP</button>
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
