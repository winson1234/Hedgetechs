// --- AUTHENTICATION GUARD ---
const loggedInUser = localStorage.getItem('loggedInUser');
const currentPath = window.location.pathname;
const isAuthPage = currentPath === '/login.html' ||
                   currentPath === '/register.html' ||
                   currentPath === '/forgotPassword.html';

if (!loggedInUser && !isAuthPage) {
  window.location.href = '/login.html';
}
// --- END GUARD ---

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

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

// Only mount the React app if the user is logged in
if (localStorage.getItem('loggedInUser')) {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Elements stripe={stripePromise}>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </Elements>
    </React.StrictMode>
  )
}
