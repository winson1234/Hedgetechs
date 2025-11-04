import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import './profile.css';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const { isDarkMode } = useUIStore();
  const navigate = useNavigate();

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [editingPersonalInfo, setEditingPersonalInfo] = useState(false);
  const [editingLanguageRegion, setEditingLanguageRegion] = useState(false);

  const [profileData, setProfileData] = useState({
    name: user?.name || 'John Doe',
    email: user?.email || 'john.doe@fpmarkets.com',
    phone: '',
    country: 'United States',
    language: 'English (US)',
    timezone: 'GMT+8 (Kuala Lumpur)',
    currency: 'USD ($)',
    profilePicture: null as string | null,
  });

  const [formData, setFormData] = useState({ ...profileData });
  const [formErrors, setFormErrors] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    retypePassword: '',
  });
  const [passwordMessage, setPasswordMessage] = useState({ text: '', type: '' });
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, text: '', className: '' });

  const [toggleStates, setToggleStates] = useState({
    twoFactor: false,
    emailNotifications: false,
    loginAlerts: false,
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingSaveAction = useRef<(() => void) | null>(null);

  const countryNames: Record<string, string> = {
    MY: "Malaysia", SG: "Singapore", TH: "Thailand", ID: "Indonesia",
    PH: "Philippines", VN: "Vietnam", US: "United States", GB: "United Kingdom",
    AU: "Australia", CN: "China", JP: "Japan", KR: "South Korea",
    IN: "India", DE: "Germany", FR: "France", IT: "Italy",
    ES: "Spain", CA: "Canada", BR: "Brazil", MX: "Mexico"
  };

  // Initialize theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Password strength calculator
  useEffect(() => {
    if (!passwordData.newPassword) {
      setPasswordStrength({ level: 0, text: '', className: '' });
      return;
    }

    let strength = 0;
    if (passwordData.newPassword.length >= 8) strength++;
    if (passwordData.newPassword.length >= 12) strength++;
    if (/[a-z]/.test(passwordData.newPassword) && /[A-Z]/.test(passwordData.newPassword)) strength++;
    if (/\d/.test(passwordData.newPassword)) strength++;
    if (/[^a-zA-Z0-9]/.test(passwordData.newPassword)) strength++;

    let text = '', className = '';
    if (strength <= 2) {
      text = 'Weak';
      className = 'weak';
    } else if (strength <= 4) {
      text = 'Medium';
      className = 'medium';
    } else {
      text = 'Strong';
      className = 'strong';
    }

    setPasswordStrength({ level: strength, text, className });
  }, [passwordData.newPassword]);

  const getInitials = (name: string) => {
    if (!name) return 'JD';
    const names = name.trim().split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleChangePhoto = () => {
    photoInputRef.current?.click();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setProfileData(prev => ({ ...prev, profilePicture: imageUrl }));
        showSuccessMessage('Profile picture updated successfully!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditPersonalInfo = () => {
    setFormData({ ...profileData });
    setFormErrors({ name: '', email: '', phone: '', country: '' });
    setEditingPersonalInfo(true);
  };

  const validatePersonalInfo = () => {
    let isValid = true;
    const errors = { name: '', email: '', phone: '', country: '' };

    const name = formData.name.trim();
    if (name.length < 2) {
      errors.name = 'Name must be at least 2 characters';
      isValid = false;
    } else if (!/^[a-zA-Z\s]+$/.test(name)) {
      errors.name = 'Name can only contain letters and spaces';
      isValid = false;
    }

    const email = formData.email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    const phone = formData.phone.trim();
    const phoneRegex = /^[\d\s\-+()]+$/;
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
      errors.phone = 'Please enter a valid phone number (min 10 digits)';
      isValid = false;
    }

    if (!formData.country) {
      errors.country = 'Please select a country';
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSavePersonalInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePersonalInfo()) return;

    pendingSaveAction.current = () => {
      setProfileData({ ...formData });
      setEditingPersonalInfo(false);
      showSuccessMessage('Profile updated successfully!');
    };
    setConfirmationModalOpen(true);
  };

  const handleConfirmSave = () => {
    if (pendingSaveAction.current) {
      pendingSaveAction.current();
      pendingSaveAction.current = null;
    }
    setConfirmationModalOpen(false);
  };

  const handleCancelEdit = () => {
    setEditingPersonalInfo(false);
    setFormData({ ...profileData });
  };

  const handleEditLanguageRegion = () => {
    setFormData({ ...profileData });
    setEditingLanguageRegion(true);
  };

  const handleSaveLanguageRegion = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileData({
      ...profileData,
      language: formData.language,
      timezone: formData.timezone,
      currency: formData.currency,
    });
    setEditingLanguageRegion(false);
    showSuccessMessage('Language & Region updated successfully!');
  };

  const handleCancelLanguageEdit = () => {
    setEditingLanguageRegion(false);
    setFormData({ ...profileData });
  };

  const handleSavePassword = () => {
    setPasswordMessage({ text: '', type: '' });

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.retypePassword) {
      setPasswordMessage({ text: 'Please fill in all fields.', type: 'error' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordMessage({ text: 'New password must be at least 8 characters.', type: 'error' });
      return;
    }

    if (passwordData.newPassword !== passwordData.retypePassword) {
      setPasswordMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setPasswordMessage({ text: 'Password updated successfully!', type: 'success' });
    setTimeout(() => {
      setChangePasswordModalOpen(false);
      setPasswordData({ currentPassword: '', newPassword: '', retypePassword: '' });
      setPasswordMessage({ text: '', type: '' });
    }, 1500);
  };

  const showSuccessMessage = (message: string) => {
    // Simple alert for now - can be replaced with a toast component
    setTimeout(() => alert(message), 100);
  };

  return (
    <>
      {/* Confirmation Modal */}
      {confirmationModalOpen && (
        <div className="modal-overlay" onClick={() => setConfirmationModalOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Changes</h3>
            <p>Are you sure you want to save these changes?</p>
            <div className="modal-actions">
              <button onClick={handleConfirmSave} className="confirm-btn">Confirm</button>
              <button onClick={() => setConfirmationModalOpen(false)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <main className="main-content">
        <div className="profile-header">
          <div className="profile-top">
            <div className="profile-left">
              <div className="profile-avatar-container">
                <div className="profile-avatar">
                  {profileData.profilePicture ? (
                    <img src={profileData.profilePicture} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} alt="Profile" />
                  ) : (
                    <span>{getInitials(profileData.name)}</span>
                  )}
                </div>
                <button className="change-photo-btn" onClick={handleChangePhoto}>
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                  </svg>
                </button>
                <input
                  type="file"
                  ref={photoInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
              </div>
              <div className="profile-info">
                <h1>{profileData.name}</h1>
                <p>📧 {profileData.email}</p>
                <p className={!profileData.phone ? 'warning' : ''}>
                  📱 {profileData.phone || 'Update your phone number'}
                </p>
                <span className="verification-badge">
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  Verified Account
                </span>
              </div>
            </div>
          </div>

          <div className="account-stats">
            <div className="stat-item">
              <div className="stat-value">2 Yrs</div>
              <div className="stat-label">Member Since</div>
            </div>

            <div className="stat-item">
              <div className="stat-value">✓ Verified</div>
              <div className="stat-label">Verification Status</div>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          {/* Personal Information Card */}
          <div className="profile-card">
            <div className="card-header">
              <h2 className="card-title">Personal Information</h2>
              {!editingPersonalInfo && (
                <button className="edit-link" onClick={handleEditPersonalInfo}>Edit Profile</button>
              )}
            </div>

            {!editingPersonalInfo ? (
              <div className="info-section">
                <h3 className="section-title">Contact Details</h3>
                <div className="info-row">
                  <span className="info-label">Full Name</span>
                  <span className="info-value">{profileData.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Email Address</span>
                  <span className="info-value">{profileData.email}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Phone Number</span>
                  <span className={`info-value ${!profileData.phone ? 'warning' : ''}`}>
                    {profileData.phone || 'Update your phone number'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">Country</span>
                  <span className="info-value">{profileData.country}</span>
                </div>
              </div>
            ) : (
              <div className="info-section">
                <h3 className="section-title">Contact Details</h3>
                <form className="edit-form" onSubmit={handleSavePersonalInfo}>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={formErrors.name ? 'error' : ''}
                      required
                    />
                    {formErrors.name && <span className="error-message">{formErrors.name}</span>}
                  </div>
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={formErrors.email ? 'error' : ''}
                      required
                    />
                    {formErrors.email && <span className="error-message">{formErrors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={formErrors.phone ? 'error' : ''}
                      required
                    />
                    {formErrors.phone && <span className="error-message">{formErrors.phone}</span>}
                  </div>
                  <div className="form-group">
                    <label>Country *</label>
                    <select
                      value={Object.keys(countryNames).find(key => countryNames[key] === formData.country) || ''}
                      onChange={(e) => setFormData({ ...formData, country: countryNames[e.target.value] })}
                      className={formErrors.country ? 'error' : ''}
                      required
                    >
                      <option value="">Select your country</option>
                      {Object.entries(countryNames).map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                      ))}
                    </select>
                    {formErrors.country && <span className="error-message">{formErrors.country}</span>}
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="save-btn">Save Changes</button>
                    <button type="button" className="cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Security Settings Card */}
          <div className="profile-card">
            <div className="card-header">
              <h2 className="card-title">Security Settings</h2>
              <button className="edit-link" onClick={() => navigate('/settings/security')}>Manage</button>
            </div>

            <div className="security-item">
              <div className="security-info">
                <div className="security-icon">🔐</div>
                <div className="security-text">
                  <h4>Two-Factor Authentication</h4>
                  <p>Enabled via SMS</p>
                </div>
              </div>
              <button
                className={`toggle-btn ${toggleStates.twoFactor ? 'active' : ''}`}
                onClick={() => setToggleStates({ ...toggleStates, twoFactor: !toggleStates.twoFactor })}
              ></button>
            </div>

            <div className="security-item">
              <div className="security-info">
                <div className="security-icon">📧</div>
                <div className="security-text">
                  <h4>Email Notifications</h4>
                  <p>Trade alerts enabled</p>
                </div>
              </div>
              <button
                className={`toggle-btn ${toggleStates.emailNotifications ? 'active' : ''}`}
                onClick={() => setToggleStates({ ...toggleStates, emailNotifications: !toggleStates.emailNotifications })}
              ></button>
            </div>

            <div className="security-item">
              <div className="security-info">
                <div className="security-icon">🔔</div>
                <div className="security-text">
                  <h4>Login Alerts</h4>
                  <p>New device notifications</p>
                </div>
              </div>
              <button
                className={`toggle-btn ${toggleStates.loginAlerts ? 'active' : ''}`}
                onClick={() => setToggleStates({ ...toggleStates, loginAlerts: !toggleStates.loginAlerts })}
              ></button>
            </div>

            <button className="confirm-btn" onClick={() => setChangePasswordModalOpen(true)}>Change Password</button>
          </div>

          {/* Language & Region Card */}
          <div className="profile-card">
            <div className="card-header">
              <h2 className="card-title">Language & Region</h2>
              {!editingLanguageRegion && (
                <button className="edit-link" onClick={handleEditLanguageRegion}>Edit</button>
              )}
            </div>

            {!editingLanguageRegion ? (
              <div className="info-section">
                <div className="info-row">
                  <span className="info-label">Language</span>
                  <span className="info-value">{profileData.language}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Timezone</span>
                  <span className="info-value">{profileData.timezone}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Currency Display</span>
                  <span className="info-value">{profileData.currency}</span>
                </div>
              </div>
            ) : (
              <form className="edit-form" onSubmit={handleSaveLanguageRegion}>
                <div className="form-group">
                  <label>Language *</label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    required
                  >
                    <option value="English (US)">English (US)</option>
                    <option value="English (UK)">English (UK)</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Chinese">Chinese</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Timezone *</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    required
                  >
                    <option value="GMT-5 (New York)">GMT-5 (New York)</option>
                    <option value="GMT (London)">GMT (London)</option>
                    <option value="GMT+1 (Paris)">GMT+1 (Paris)</option>
                    <option value="GMT+8 (Kuala Lumpur)">GMT+8 (Kuala Lumpur)</option>
                    <option value="GMT+8 (Singapore)">GMT+8 (Singapore)</option>
                    <option value="GMT+10 (Sydney)">GMT+10 (Sydney)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Currency Display *</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    required
                  >
                    <option value="USD ($)">USD ($)</option>
                    <option value="EUR (�)">EUR (�)</option>
                    <option value="GBP (�)">GBP (�)</option>
                    <option value="MYR (RM)">MYR (RM)</option>
                    <option value="SGD (S$)">SGD (S$)</option>
                    <option value="AUD (A$)">AUD (A$)</option>
                  </select>
                </div>
                <div className="form-actions">
                  <button type="submit" className="save-btn">Save Changes</button>
                  <button type="button" className="cancel-btn" onClick={handleCancelLanguageEdit}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Change Password Modal */}
      {changePasswordModalOpen && (
        <div className="modal-overlay" onClick={() => setChangePasswordModalOpen(false)}>
          <div className="password-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Change Password</h3>

            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                placeholder="Enter current password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                placeholder="Enter new password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
            </div>
            {passwordData.newPassword && (
              <div className="password-strength show">
                <div className="strength-bar">
                  <div className={`strength-bar-fill ${passwordStrength.className}`}></div>
                </div>
                <div className={`strength-text ${passwordStrength.className}`}>
                  {passwordStrength.text}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="retypePassword">Retype Password</label>
              <input
                type="password"
                id="retypePassword"
                placeholder="Re-enter new password"
                value={passwordData.retypePassword}
                onChange={(e) => setPasswordData({ ...passwordData, retypePassword: e.target.value })}
              />
            </div>

            <div className="modal-actions">
              <button onClick={() => setChangePasswordModalOpen(false)} className="cancel-btn">Cancel</button>
              <button onClick={handleSavePassword} className="confirm-btn">Reset</button>
            </div>

            {passwordMessage.text && (
              <div className={`message ${passwordMessage.type}`}>
                {passwordMessage.text}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
