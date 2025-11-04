import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import './securitySettings.css';

interface Device {
  id: string;
  icon: string;
  name: string;
  browser: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export default function SecuritySettingsPage() {
  const { user, logout } = useAuthStore();
  const { isDarkMode, setDarkMode } = useUIStore();
  const navigate = useNavigate();

  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showTFAModal, setShowTFAModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [generatedOTP, setGeneratedOTP] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendDisabled, setResendDisabled] = useState(true);
  const [timeLeft, setTimeLeft] = useState(60);
  const [deviceToRemove, setDeviceToRemove] = useState<Device | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [devices, setDevices] = useState<Device[]>([
    { id: '1', icon: '💻', name: 'MacBook Pro 16"', browser: 'Chrome on macOS', location: 'Kuala Lumpur, Malaysia', lastActive: 'Just now', isCurrent: true },
    { id: '2', icon: '📱', name: 'iPhone 15 Pro', browser: 'Safari on iOS', location: 'Petaling Jaya, Malaysia', lastActive: '2 hours ago', isCurrent: false },
    { id: '3', icon: '🖥️', name: 'Windows Desktop', browser: 'Edge on Windows 11', location: 'Singapore', lastActive: '1 day ago', isCurrent: false },
    { id: '4', icon: '📲', name: 'iPad Air', browser: 'Safari on iPadOS', location: 'Kuala Lumpur, Malaysia', lastActive: '3 days ago', isCurrent: false },
  ]);

  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Initialize theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Countdown timer for OTP
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showTFAModal && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setResendDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showTFAModal, timeLeft]);

  const handleThemeToggle = () => {
    setDarkMode(!isDarkMode);
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  };

  const generateOTP = () => {
    const newOTP = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(newOTP);
    console.log('Generated OTP (for testing):', newOTP);
    return newOTP;
  };

  const handleToggle2FA = () => {
    if (!is2FAEnabled) {
      setShowTFAModal(true);
      generateOTP();
      setTimeLeft(60);
      setResendDisabled(true);
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
    } else {
      setIs2FAEnabled(false);
      showSuccessToast('Two-Factor Authentication has been disabled');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleVerifyOTP = () => {
    const enteredOtp = otp.join('');
    if (enteredOtp.length < 6) {
      setOtpError('Please enter the complete 6-digit OTP');
      return;
    }

    if (enteredOtp !== generatedOTP) {
      setOtpError('Invalid OTP. Please try again.');
      setOtp(['', '', '', '', '', '']);
      return;
    }

    setIs2FAEnabled(true);
    setShowTFAModal(false);
    showSuccessToast('Two-Factor Authentication has been enabled successfully!');
  };

  const handleResendOTP = () => {
    if (!resendDisabled) {
      generateOTP();
      setTimeLeft(60);
      setResendDisabled(true);
      setOtp(['', '', '', '', '', '']);
      setOtpError('');
      showSuccessToast('New OTP sent!');
    }
  };

  const handleRemoveDevice = (device: Device) => {
    setDeviceToRemove(device);
    setShowRemoveModal(true);
  };

  const confirmRemoveDevice = () => {
    if (deviceToRemove) {
      setDevices(devices.filter(d => d.id !== deviceToRemove.id));
      showSuccessToast(`${deviceToRemove.name} has been removed successfully!`);
      setShowRemoveModal(false);
      setDeviceToRemove(null);
    }
  };

  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const getInitials = (name: string) => {
    if (!name) return 'JD';
    const names = name.trim().split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Main Content */}
      <div className="main-content">
        <div className="page-header">
          <h1 className="page-title">Security Settings</h1>
          <p className="page-subtitle">Manage your account security and connected devices</p>
        </div>

        {/* Security Stats */}
        <div className="security-stats">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value" id="accountStatus">{is2FAEnabled ? 'Highly Protected' : 'Protected'}</div>
              <div className="stat-label">Account Status</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{is2FAEnabled ? 'Enabled' : 'Disabled'}</div>
              <div className="stat-label">Two-Factor Auth</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{devices.length}</div>
              <div className="stat-label">Active Devices</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">Just now</div>
              <div className="stat-label">Last Activity</div>
            </div>
          </div>
        </div>

        <div className="security-grid">
          {/* 2FA Card */}
          <div className="security-card featured">
            <div className="card-header">
              <div className="card-title">
                <div className="card-icon">🔐</div>
                Two-Factor Authentication
              </div>
              <span className={`status-badge ${is2FAEnabled ? 'active' : ''}`}>{is2FAEnabled ? 'Active' : 'Inactive'}</span>
            </div>

            <div className="twofa-content">
              <div className="twofa-visual">
                <div className={`twofa-status ${is2FAEnabled ? 'enabled' : 'disabled'}`}>
                  {is2FAEnabled ? '✓' : '🔒'}
                </div>
                <div className="twofa-info">
                  <h3 className="twofa-title">{is2FAEnabled ? '2FA Enabled' : '2FA Disabled'}</h3>
                  <p className="twofa-description">
                    Add an extra layer of security to your account by enabling two-factor authentication.
                  </p>
                </div>
              </div>

              <div className="security-benefits">
                <div className="benefit-item">
                  <span className="benefit-icon">✓</span>
                  <span>Protect against unauthorized access</span>
                </div>
                <div className="benefit-item">
                  <span className="benefit-icon">✓</span>
                  <span>Secure your sensitive data</span>
                </div>
                <div className="benefit-item">
                  <span className="benefit-icon">✓</span>
                  <span>Industry-standard authentication</span>
                </div>
              </div>

              <div className="toggle-container" onClick={handleToggle2FA}>
                <div className="toggle-content">
                  <span className="toggle-label">Enable Two-Factor Authentication</span>
                  <p className="toggle-sublabel">Requires authentication code on each login</p>
                </div>
                <div className={`toggle-switch ${is2FAEnabled ? 'active' : ''}`}>
                  <div className="toggle-slider"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Devices Card */}
          <div className="security-card">
            <div className="card-header">
              <div className="card-title">
                <div className="card-icon">📱</div>
                Connected Devices
              </div>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{devices.length} active devices</span>
            </div>

            <div className="devices-intro">
              <p>Manage all devices that have access to your account. Remove any unfamiliar devices immediately.</p>
            </div>

            <div id="devicesList">
              {devices.map(device => (
                <div key={device.id} className={`device-item ${device.isCurrent ? 'current-device' : ''}`} data-device-id={device.id}>
                  <div className="device-info">
                    <div className="device-icon">{device.icon}</div>
                    <div className="device-details">
                      <h4>{device.name}</h4>
                      <p>{device.browser} • {device.location}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Last active: {device.lastActive}</p>
                      <span className={`device-badge ${device.isCurrent ? 'current' : 'active'}`}>
                        {device.isCurrent ? 'Current Device' : 'Active'}
                      </span>
                    </div>
                  </div>
                  <button
                    className="remove-device-btn"
                    disabled={device.isCurrent}
                    onClick={() => !device.isCurrent && handleRemoveDevice(device)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    {device.isCurrent ? 'Current' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Card */}
          <div className="security-card full-width">
            <div className="card-header">
              <div className="card-title">
                <div className="card-icon">📊</div>
                Recent Security Activity
              </div>
              <button className="view-all-btn">View All</button>
            </div>

            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div className="activity-details">
                  <h4>Successful Login</h4>
                  <p>MacBook Pro 16&quot; • Chrome • Kuala Lumpur, Malaysia</p>
                  <p className="activity-time">Today at 10:30 AM</p>
                </div>
                <div className="activity-status success">Successful</div>
              </div>

              <div className="activity-item">
                <div className="activity-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div className="activity-details">
                  <h4>Password Changed</h4>
                  <p>Password successfully updated</p>
                  <p className="activity-time">30 days ago</p>
                </div>
                <div className="activity-status info">Completed</div>
              </div>

              <div className="activity-item">
                <div className="activity-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                </div>
                <div className="activity-details">
                  <h4>New Device Added</h4>
                  <p>iPhone 15 Pro • Safari • Petaling Jaya, Malaysia</p>
                  <p className="activity-time">45 days ago</p>
                </div>
                <div className="activity-status info">New Device</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2FA Modal */}
      {showTFAModal && (
        <div className="modal-overlay show" onClick={() => setShowTFAModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowTFAModal(false)}>&times;</button>

            <div className="modal-header">
              <div className="modal-icon">🔐</div>
              <h2 className="modal-title">Verify Your Identity</h2>
              <p className="modal-description">Enter the 6-digit verification code sent to your email</p>
            </div>

            <div className="otp-section">
              <div className="otp-inputs">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    maxLength={1}
                    className={`otp-digit ${digit ? 'filled' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  />
                ))}
              </div>

              <div className="resend-section">
                <p className="resend-text">Didn&apos;t receive the code?</p>
                <button className="resend-btn" disabled={resendDisabled} onClick={handleResendOTP}>
                  Resend OTP {timeLeft > 0 && <span className="timer">({timeLeft}s)</span>}
                </button>
              </div>

              <div className={`error-message ${otpError ? 'show' : ''}`}>{otpError}</div>
              <button className="verify-btn" onClick={handleVerifyOTP}>Verify & Enable 2FA</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Device Modal */}
      {showRemoveModal && (
        <div className="modal-overlay show" onClick={() => setShowRemoveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowRemoveModal(false)}>&times;</button>
            <div className="modal-header">
              <div className="modal-icon">⚠️</div>
              <h3 className="modal-title">Remove Device?</h3>
              <p className="modal-description">
                Are you sure you want to remove &quot;{deviceToRemove?.name}&quot;? You&apos;ll need to log in again on this device.
              </p>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowRemoveModal(false)}>Cancel</button>
              <button className="confirm-btn" onClick={confirmRemoveDevice}>Remove Device</button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      <div className={`success-toast ${showToast ? 'show' : ''}`}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>{toastMessage}</span>
      </div>
    </>
  );
}
