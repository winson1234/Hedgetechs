import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor, useAppDispatch, useAppSelector } from './store'
import { refreshSession, setSession } from './store/slices/authSlice'
import App from './App'
import './index.css'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from './lib/supabase'

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

// Auth wrapper component to initialize auth state and listen to Supabase auth changes
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    // Check initial session
    dispatch(refreshSession())

    // Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setSession({
        user: session?.user || null,
        session: session,
      }))
    })

    // Cleanup subscription
    return () => {
      subscription.unsubscribe()
    }
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

// Always mount the React app
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
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
  </React.StrictMode>
)
