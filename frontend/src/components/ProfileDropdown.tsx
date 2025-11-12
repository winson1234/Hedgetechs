import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { signOut } from '../store/slices/authSlice';

// Password hashing utility using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

type ProfileDropdownProps = {
  isOpen: boolean;
  closeDropdown: () => void;
};

export default function ProfileDropdown({
  isOpen,
  closeDropdown,
}: ProfileDropdownProps) {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{text: string; type: 'success' | 'error'} | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<{strength: string; class: string} | null>(null);

  // Access Redux store
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const { accounts, activeAccountId } = useAppSelector(state => state.account);

  const activeAccount = accounts.find(acc => acc.id === activeAccountId);
  const activeAccountType = activeAccount?.type;

  const handleLogOut = () => {
    setShowLogoutModal(true);
    closeDropdown();
  };

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
    closeDropdown();
  };
const confirmLogout = async () => {
  // 1. Clear persisted data (old Zustand stores)
  localStorage.removeItem('account-store');
  localStorage.removeItem('order-store');
  localStorage.removeItem('transaction-storage');
  localStorage.removeItem('ui-store');
  localStorage.removeItem('fx_rates_cache');
  localStorage.removeItem('fx_rates_cache_time');

  // 2. Dispatch Redux logout
  await dispatch(signOut());

  // 3. Close modal and redirect directly to dashboard
  setShowLogoutModal(false);
  navigate('/dashboard', { replace: true });
};


  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  const checkPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength: 'Weak', class: 'weak' };
    else if (strength <= 4) return { strength: 'Medium', class: 'medium' };
    else return { strength: 'Strong', class: 'strong' };
  };

  const handleNewPasswordChange = (value: string) => {
    setNewPassword(value);
    if (value) {
      setPasswordStrength(checkPasswordStrength(value));
    } else {
      setPasswordStrength(null);
    }
  };

  const handleSavePassword = async () => {
    // Basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ text: 'Please fill in all fields.', type: 'error' });
      return;
    }

    // Verify current password against stored hash
    const storedHash = localStorage.getItem(`userPasswordHash_${user?.email}`);
    if (!storedHash) {
      setPasswordMessage({
        text: 'Password validation unavailable. Please logout and login again to enable password changes.',
        type: 'error'
      });
      return;
    }

    try {
      const currentHash = await hashPassword(currentPassword);
      if (currentHash !== storedHash) {
        setPasswordMessage({ text: 'Current password is incorrect.', type: 'error' });
        return;
      }
    } catch (error) {
      console.error('Password hashing error:', error);
      setPasswordMessage({ text: 'An error occurred while validating password.', type: 'error' });
      return;
    }

    // Match validation
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    // Length validation
    if (newPassword.length < 6) {
      setPasswordMessage({ text: 'Password must be at least 6 characters long.', type: 'error' });
      return;
    }

    // Strength validation
    if (passwordStrength && passwordStrength.class === 'weak') {
      setPasswordMessage({ text: 'Password is too weak. Please choose a stronger password.', type: 'error' });
      return;
    }

    // Hash and save new password
    try {
      const newHash = await hashPassword(newPassword);
      localStorage.setItem(`userPasswordHash_${user?.email}`, newHash);

      // Update registered users database
      const registeredUsersData = localStorage.getItem('registeredUsers');
      if (registeredUsersData && user?.email) {
        const registeredUsers = JSON.parse(registeredUsersData);
        if (registeredUsers[user.email]) {
          registeredUsers[user.email].passwordHash = newHash;
          localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        }
      }

      // Show success and close
      setPasswordMessage({ text: 'Password changed successfully!', type: 'success' });
      setTimeout(() => {
        handleCancelChangePassword();
      }, 1500);
    } catch (error) {
      console.error('Password update error:', error);
      setPasswordMessage({ text: 'An error occurred while updating password.', type: 'error' });
    }
  };

  const handleCancelChangePassword = () => {
    setShowChangePasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage(null);
    setPasswordStrength(null);
  };

  const handleProfileClick = () => {
    closeDropdown();
    navigate('/profile');
  };

  const handleSettingsClick = () => {
    closeDropdown();
    navigate('/settings/security');
  };

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  // Create a renderable element for the account type badge
  const accountTypeDisplay = () => {
    if (activeAccountType === 'live') {
      return (
        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
          Live Account
        </span>
      );
    }
    if (activeAccountType === 'demo') {
      return (
        <span className="text-[10px] font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded uppercase tracking-wider">
          Demo Account
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        No Active Account
      </span>
    );
  };

  // Show change password modal
  if (showChangePasswordModal) {
    return (
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={handleCancelChangePassword}
      >
        <div 
          className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-[90%] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 text-center">
            Change Password
          </h3>

          {/* Current Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* New Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => handleNewPasswordChange(e.target.value)}
              placeholder="Enter new password"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {/* Password Strength Indicator */}
            {passwordStrength && (
              <div className="mt-2">
                <div className="h-1 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      passwordStrength.class === 'weak' ? 'w-1/3 bg-red-500' :
                      passwordStrength.class === 'medium' ? 'w-2/3 bg-yellow-500' :
                      'w-full bg-green-500'
                    }`}
                  />
                </div>
                <p className={`text-xs mt-1 font-medium ${
                  passwordStrength.class === 'weak' ? 'text-red-500' :
                  passwordStrength.class === 'medium' ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {passwordStrength.strength}
                </p>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Retype Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Message */}
          {passwordMessage && (
            <div className={`text-center text-sm font-medium mb-4 ${
              passwordMessage.type === 'success' ? 'text-green-500' : 'text-red-500'
            }`}>
              {passwordMessage.text}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleCancelChangePassword}
              className="px-6 py-3 rounded-lg font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePassword}
              className="px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-br from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 hover:-translate-y-0.5 transition shadow-lg hover:shadow-indigo-500/40"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show logout modal
  if (showLogoutModal) {
    return (
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={cancelLogout}
      >
        <div 
          className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-[90%] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Confirm Logout
          </h3>
          <p className="text-base text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
            Are you sure you want to logout? Your session data will be cleared.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={cancelLogout}
              className="px-6 py-3 rounded-lg font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmLogout}
              className="px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 hover:-translate-y-0.5 transition shadow-lg hover:shadow-red-500/40"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't show dropdown if not open
  if (!isOpen) return null;

  return (
    <div
      className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50"
    >
      {/* User Info Section */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
              {displayName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {accountTypeDisplay()}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        {/* Profile Button */}
        <button
          onClick={handleProfileClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>Profile</span>
        </button>

        {/* Change Password Button */}
        <button
          onClick={handleChangePassword}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <span>Change Password</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={handleSettingsClick}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Settings</span>
        </button>

        {/* Log Out Button */}
        <button
          onClick={handleLogOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}