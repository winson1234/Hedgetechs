import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PublicRoute from './components/PublicRoute'
import AppLayout from './components/AppLayout'
import { useAppDispatch, useAppSelector } from './store'
import { fetchAccounts } from './store/slices/accountSlice'
import { hydrateFrom24hData, setLoading } from './store/slices/priceSlice'
import { useInstruments } from './hooks/useInstruments'
import { getApiUrl } from './config/api'

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
  const dispatch = useAppDispatch()
  const { user, loading: authLoading } = useAppSelector((state) => state.auth)
  const isLoggedIn = !!user

  // Get instruments for hydrating price store
  const { instruments } = useInstruments()

  // Hydrate price store with 24h ticker data on mount (for ALL routes, including dashboard)
  useEffect(() => {
    // Wait for instruments to be loaded before hydrating
    if (instruments.length === 0) return

    const hydratePrices = async () => {
      try {
        // Build symbols list from instruments API (crypto + commodity instruments for ticker)
        // Forex uses MT5/Redis, so exclude those
        const tickerInstruments = instruments.filter(inst =>
          inst.instrument_type === 'crypto' || inst.instrument_type === 'commodity'
        )
        if (tickerInstruments.length === 0) return

        const symbols = tickerInstruments.map(inst => inst.symbol).join(',')
        const response = await fetch(getApiUrl(`/api/v1/ticker?symbols=${symbols}`))
        if (!response.ok) throw new Error('Failed to fetch 24h ticker data')
        const data = await response.json()
        dispatch(hydrateFrom24hData(data))
      } catch (err) {
        console.error('Failed to hydrate price store:', err)
        dispatch(setLoading(false))
      }
    }
    hydratePrices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruments.length])

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
