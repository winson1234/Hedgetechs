import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { setAuth } from '../store/slices/authSlice';
import { selectIsDarkMode } from '../store/slices/uiSlice';
import { updateProfile, getProfile } from '../services/auth';
import ConfirmDialog from '../components/ConfirmDialog';
import './profile.css';

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

export default function ProfilePage() {
  const user = useAppSelector(state => state.auth.user);
  const token = useAppSelector(state => state.auth.token);
  const isDarkMode = useAppSelector(selectIsDarkMode);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [editingPersonalInfo, setEditingPersonalInfo] = useState(false);
  const [editingLanguageRegion, setEditingLanguageRegion] = useState(false);

  const countryNames: Record<string, string> = {
    MY: "Malaysia", SG: "Singapore", TH: "Thailand", ID: "Indonesia",
    PH: "Philippines", VN: "Vietnam", US: "United States", GB: "United Kingdom",
    AU: "Australia", CN: "China", JP: "Japan", KR: "South Korea",
    IN: "India", DE: "Germany", FR: "France", IT: "Italy",
    ES: "Spain", CA: "Canada", BR: "Brazil", MX: "Mexico"
  };

  // Helper to format phone on load/sync
  const formatInitialPhone = (phone: string | undefined, countryName: string | undefined) => {
    if (!phone) return '';
    // Auto-format Malaysia numbers if they start with 01
    if (phone.startsWith('01')) {
      return '+60' + phone.substring(1);
    }
    return phone;
  };

  const [profileData, setProfileData] = useState({
    name: user ? `${user.first_name} ${user.last_name}`.trim() || user.email.split('@')[0] : 'User',
    email: user?.email || 'user@example.com',
    phone: formatInitialPhone(user?.phone_number, user?.country),
    country: user?.country || 'United States',
    language: 'English (US)',
    timezone: 'GMT+8 (Kuala Lumpur)',
    currency: 'USD ($)',
    currency: 'USD ($)',
    profilePicture: user?.profile_picture || null,
  });

  // Fetch latest profile on mount to ensure data persistence
  useEffect(() => {
    const fetchLatestProfile = async () => {
      try {
        const { user: updatedUser } = await getProfile();
        if (updatedUser && token) {
          dispatch(setAuth({ user: updatedUser, token }));
        }
      } catch (error) {
        console.error('Failed to fetch latest profile:', error);
      }
    };
    fetchLatestProfile();
  }, [dispatch, token]);

  // Sync profileData when user updates
  useEffect(() => {
    if (user) {
      const formattedPhone = formatInitialPhone(user.phone_number, user.country);

      setProfileData(prev => ({
        ...prev,
        name: `${user.first_name} ${user.last_name}`.trim() || user.email.split('@')[0],
        email: user.email,
        phone: formattedPhone,
        country: user.country || 'United States',
        profilePicture: user.profile_picture || null,
      }));

      // Also update formData if we are not editing currently? 
      // Or simply let the user see the new data when they open edit.
      // But we need to update formData if we want "Edit" to show formatted value.
      setFormData(prev => ({
        ...prev,
        // Only update if not editing to avoid overwriting user input?
        // But this runs on mount/user change.
        // If user just saved, this runs.
        // If user just refreshed, this runs.
        phone: formattedPhone,
        // We should probably sync all fields to be safe, but phone is the critical one here.
        name: `${user.first_name} ${user.last_name}`.trim() || user.email.split('@')[0],
        country: user.country || 'United States',
        email: user.email,
        profilePicture: user.profile_picture || null,
      }));
    }
  }, [user]);


  const [formData, setFormData] = useState({ ...profileData });
  const [formErrors, setFormErrors] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
  });

  const [toggleStates, setToggleStates] = useState({
    twoFactor: false,
    emailNotifications: false,
    loginAlerts: false,
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingSaveAction = useRef<(() => void) | null>(null);


  // Initialize theme - apply to html element for profile.css compatibility
  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

    // Also apply to body for consistency with other pages
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

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
      reader.onload = async (event) => {
        const imageUrl = event.target?.result as string;

        // Instant UI update
        setProfileData(prev => ({ ...prev, profilePicture: imageUrl }));

        try {
          // Persist to backend immediately
          // We need existing fields as backend requires them
          const nameParts = profileData.name.trim().split(' ');
          const fName = nameParts[0];
          const lName = nameParts.slice(1).join(' ') || '.';

          const { user: updatedUser } = await updateProfile({
            first_name: fName,
            last_name: lName,
            phone_number: profileData.phone,
            country: profileData.country,
            profile_picture: imageUrl
          });

          if (updatedUser && token) {
            dispatch(setAuth({ user: updatedUser, token }));
          }

          showSuccessMessage('Profile picture updated successfully!');
        } catch (error) {
          console.error('Failed to save photo:', error);
          alert('Failed to save profile picture. Please try again.');
        }
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
    setFormErrors(errors);
    return isValid;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newPhone = e.target.value;
    let newCountry = formData.country;

    // Find country code from name since ProfilePage stores country name in formData.country
    // But wait, formData.country stores the NAME ("Malaysia"), but detections use CODE ("MY").
    // I need to map between them.
    // existing countryNames map: Code -> Name.
    // I need Name -> Code or just work with Codes if possible?
    // ProfilePage state uses Names.
    // Let's create a helper to find Code from Name if needed, but here we detect Code.

    // Auto-detect Malaysia from local "01..." format
    if (newPhone.startsWith('01')) {
      newPhone = '+60' + newPhone.substring(1);
      newCountry = countryNames['MY'];
    }
    // Auto-detect based on country codes
    else {
      if (newPhone.startsWith('+')) {
        for (const [code, prefix] of Object.entries(COUNTRY_PREFIXES)) {
          if (newPhone.startsWith(prefix)) {
            newCountry = countryNames[code];
            break;
          }
        }
      } else {
        // Check for raw number start (e.g. 60...)
        for (const [code, prefix] of Object.entries(COUNTRY_PREFIXES)) {
          const rawPrefix = prefix.replace('+', '');
          if (newPhone.startsWith(rawPrefix)) {
            newPhone = '+' + newPhone;
            newCountry = countryNames[code];
            break;
          }
        }
      }
    }

    setFormData(prev => ({ ...prev, phone: newPhone, country: newCountry || prev.country }));
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const newCountryName = countryNames[code];
    let newPhone = formData.phone;

    // We need to know the OLD code to remove old prefix.
    // formData.country has the Name. find key by value.
    const oldCode = Object.keys(countryNames).find(key => countryNames[key] === formData.country) || '';

    const oldPrefix = COUNTRY_PREFIXES[oldCode] || '';
    const newPrefix = COUNTRY_PREFIXES[code] || '';

    if (oldPrefix && newPhone.startsWith(oldPrefix)) {
      newPhone = newPrefix + newPhone.substring(oldPrefix.length);
    } else if (!newPhone) {
      newPhone = newPrefix;
    }

    setFormData(prev => ({ ...prev, country: newCountryName, phone: newPhone }));
  };

  const handleSavePersonalInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePersonalInfo()) return;

    pendingSaveAction.current = async () => {
      try {
        // Split name into first and last
        const nameParts = formData.name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '.'; // Default to dot if empty, or handle validation

        const result = await updateProfile({
          first_name: firstName,
          last_name: lastName,
          first_name: firstName,
          last_name: lastName,
          phone_number: formData.phone,
          country: formData.country,
          profile_picture: formData.profilePicture || ''
        });

        // Update Redux state
        if (token) {
          dispatch(setAuth({ user: result.user, token }));
        }

        // Update local state - useEffect will handle this via Redux, but immediate update is good for responsiveness
        // Actually, since we dispatch, useEffect will trigger. But keeping local update is redundant but harmless.
        // I will keep the redundancy for immediate feel or just rely on useEffect?
        // Reliance on useEffect might cause a brief flash if redux is slow? No, it's client side.
        // I'll keep it simple.
        setEditingPersonalInfo(false);
        showSuccessMessage('Profile updated successfully!');
      } catch (error: any) {
        alert(error.message || 'Failed to update profile');
      }
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

  const showSuccessMessage = (message: string) => {
    // Simple alert for now - can be replaced with a toast component
    setTimeout(() => alert(message), 100);
  };

  return (
    <>
      {/* Confirmation Modal */}
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
                    <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
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
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                      disabled
                      className="disabled-input"
                    />
                    {formErrors.email && <span className="error-message">{formErrors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label>Phone Number *</label>
                    <div className="phone-wrapper" style={{ position: 'relative' }}>
                      {formData.country && (
                        <span className="flag-display" style={{
                          position: 'absolute',
                          left: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '1.2rem',
                          zIndex: 1
                        }}>
                          {COUNTRY_FLAGS[Object.keys(countryNames).find(key => countryNames[key] === formData.country) || '']}
                        </span>
                      )}
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        className={formErrors.phone ? 'error' : ''}
                        style={{ paddingLeft: formData.country ? '40px' : '10px' }}
                        required
                      />
                    </div>
                    {formErrors.phone && <span className="error-message">{formErrors.phone}</span>}
                  </div>
                  <div className="form-group">
                    <label>Country *</label>
                    <select
                      value={Object.keys(countryNames).find(key => countryNames[key] === formData.country) || ''}
                      onChange={handleCountryChange}
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
      <ConfirmDialog
        isOpen={confirmationModalOpen}
        title="Confirm Changes"
        message="Are you sure you want to save these changes?"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmationModalOpen(false)}
      />
    </>
  );
}
