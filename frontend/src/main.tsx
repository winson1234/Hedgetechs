import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor, useAppDispatch, useAppSelector } from './store'
import { validateSession, clearAuth } from './store/slices/authSlice'
import App from './App'
import './index.css'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Suppress Stripe telemetry errors (blocked by ad blockers)
const originalError = console.error
const originalWarn = console.warn

console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('r.stripe.com/b') ||
     args[0].includes('ERR_BLOCKED_BY_CLIENT') ||
     (args[0].includes('FetchError') && args[0].includes('stripe.com')) ||
     args[0].includes('IntegrationError') ||
     args[0].includes('Please call Stripe() with your publishable key'))
  ) {
    return // Suppress Stripe telemetry and integration errors
  }
  originalError.apply(console, args)
}

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('IntegrationError') ||
     args[0].includes('Please call Stripe() with your publishable key') ||
     args[0].includes('Stripe publishable key is missing'))
  ) {
    return // Suppress Stripe warnings
  }
  originalWarn.apply(console, args)
}

// Clear any old localStorage and sessionStorage auth data on app load
// This ensures clean state and migration from old storage
if (typeof window !== 'undefined') {
  // Remove old localStorage auth data if it exists
  if (localStorage.getItem('auth_token')) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }
  // Clear any old redux-persist auth data from localStorage
  try {
    localStorage.removeItem('persist:auth');
  } catch (e) {
    // Ignore errors
  }
  // Clear any old redux-persist auth data from sessionStorage
  try {
    sessionStorage.removeItem('persist:auth');
  } catch (e) {
    // Ignore errors
  }
}

// Load Stripe publishable key from environment
// Only load Stripe if key is provided, otherwise pass null
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey && stripeKey.trim() !== '' 
  ? loadStripe(stripeKey) 
  : null

// Log warning only once if key is missing
if (!stripeKey || stripeKey.trim() === '') {
  // Suppress the warning - it's expected in development without Stripe configured
}

// Auth wrapper component to validate JWT session on app load
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    // First, check if sessionStorage is empty - if so, clear auth state immediately
    const token = sessionStorage.getItem('auth_token')
    const userData = sessionStorage.getItem('user_data')
    
    if (!token || !userData) {
      // SessionStorage is empty (tab was closed), clear auth state
      dispatch(clearAuth())
      return
    }
    
    // Then validate session from sessionStorage
    dispatch(validateSession())
  }, [dispatch])

  return <>{children}</>
}

// Theme wrapper component to apply theme on load
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const theme = useAppSelector((state) => state.ui.theme)

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  return <>{children}</>
}

// Stripe Elements configuration using modern "deferred intent" pattern
const stripeElementsOptions = {
  mode: 'payment' as const,
  amount: 500, // Default minimum: $5.00 (in cents)
  currency: 'usd',
  appearance: {
    theme: 'stripe' as const, // Will be updated dynamically by DepositTab
  },
}

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
})

// Always mount the React app
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
          <BrowserRouter>
            <ThemeWrapper>
              <AuthWrapper>
                <Elements stripe={stripePromise} options={stripeElementsOptions}>
                  <App />
                </Elements>
              </AuthWrapper>
            </ThemeWrapper>
          </BrowserRouter>
        </PersistGate>
      </Provider>
    </QueryClientProvider>
  </React.StrictMode>
)
