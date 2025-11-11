import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import AppLayout from './components/AppLayout'
import { useAppDispatch, useAppSelector } from './store'
import { fetchAccounts } from './store/slices/accountSlice'

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
// TODO: HistoryPage needs extensive type refactoring to work with Redux slices
// import HistoryPage from './pages/HistoryPage'
import ProfilePage from './pages/ProfilePage'
import SecuritySettingsPage from './pages/SecuritySettingsPage'

export default function App() {
  const dispatch = useAppDispatch()
  const { user, loading: authLoading } = useAppSelector((state) => state.auth)
  const isLoggedIn = !!user

  // Fetch accounts when user is logged in
  useEffect(() => {
    if (isLoggedIn && !authLoading) {
      dispatch(fetchAccounts())
    }
  }, [isLoggedIn, authLoading, dispatch])

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
          {/* TODO: HistoryPage temporarily disabled pending type refactoring */}
          {/* <Route path="/history" element={<HistoryPage />} /> */}
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
