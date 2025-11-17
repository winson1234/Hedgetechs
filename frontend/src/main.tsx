import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { useAuthStore } from './stores/authStore'
import { useUIStore } from './stores/uiStore'

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

// Auth wrapper component to initialize auth state
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const checkAuthStatus = useAuthStore((state) => state.checkAuthStatus)

  useEffect(() => {
    checkAuthStatus()
  }, [checkAuthStatus])

  return <>{children}</>
}

// Theme wrapper component to initialize theme on load
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const isDarkMode = useUIStore((state) => state.isDarkMode)
  const setDarkMode = useUIStore((state) => state.setDarkMode)

  useEffect(() => {
    // Apply theme on initial load based on persisted value
    setDarkMode(isDarkMode)
  }, [isDarkMode, setDarkMode])

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
    <BrowserRouter>
      <ThemeWrapper>
        <AuthWrapper>
          <Elements stripe={stripePromise} options={stripeElementsOptions}>
            <WebSocketProvider>
              <App />
            </WebSocketProvider>
          </Elements>
        </AuthWrapper>
      </ThemeWrapper>
    </BrowserRouter>
  </React.StrictMode>
)
