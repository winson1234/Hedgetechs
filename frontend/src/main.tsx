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
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('r.stripe.com/b') ||
     args[0].includes('ERR_BLOCKED_BY_CLIENT') ||
     (args[0].includes('FetchError') && args[0].includes('stripe.com')))
  ) {
    return // Suppress Stripe telemetry errors
  }
  originalError.apply(console, args)
}

// Load Stripe publishable key from environment
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

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

// Always mount the React app
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeWrapper>
        <AuthWrapper>
          <Elements stripe={stripePromise}>
            <WebSocketProvider>
              <App />
            </WebSocketProvider>
          </Elements>
        </AuthWrapper>
      </ThemeWrapper>
    </BrowserRouter>
  </React.StrictMode>
)
