import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import AppLayout from './components/AppLayout'
import { useAuthStore } from './stores/authStore'
import { useAccountStore } from './stores/accountStore'

// Auth Pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'

// Public Pages
import DashboardPage from './pages/DashboardPage'

// Protected Pages
import TradingPage from './pages/TradingPage'
import AccountPage from './components/AccountPage'
import WalletPage from './pages/WalletPage'
import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import SecuritySettingsPage from './pages/SecuritySettingsPage'

export default function App() {
  const { checkAuthStatus, isLoggedIn, isLoading: authLoading } = useAuthStore()
  const { fetchAccounts } = useAccountStore()

  // Initialize app: Check auth status and load accounts if logged in
  useEffect(() => {
    // Check authentication status on mount
    checkAuthStatus()
  }, [checkAuthStatus])

  // Fetch accounts when user is logged in
  useEffect(() => {
    if (isLoggedIn && !authLoading) {
      fetchAccounts()
    }
  }, [isLoggedIn, authLoading, fetchAccounts])

  return (
    <Routes>
      {/* Public Routes - Redirect to dashboard if logged in */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      {/* Protected Routes - Require authentication */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/trading" element={<TradingPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings/security" element={<SecuritySettingsPage />} />
        </Route>
      </Route>

      {/* Public Dashboard - Accessible to everyone */}
      <Route path="/" element={<DashboardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
