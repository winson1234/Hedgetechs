/**
 * Authentication Store (Supabase-based)
 *
 * This store manages user authentication using Supabase Auth.
 * All authentication logic is handled server-side by Supabase.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

interface AuthUser {
  id: string
  email: string
  name?: string
  country?: string
}

interface AuthState {
  // State
  isLoggedIn: boolean
  user: AuthUser | null
  session: Session | null
  isLoading: boolean

  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>
  register: (data: {
    email: string
    password: string
    name: string
    country: string
  }) => Promise<{ success: boolean; message?: string }>
  logout: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  isLoggedIn: false,
  user: null,
  session: null,
  isLoading: true,

  /**
   * Check authentication status
   * Called on app initialization to restore session
   */
  checkAuthStatus: async () => {
    try {
      // Get current session from Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        // Session exists - user is logged in
        const user: AuthUser = {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
          country: session.user.user_metadata?.country,
        }

        set({
          isLoggedIn: true,
          user,
          session,
          isLoading: false,
        })
      } else {
        // No session - user is not logged in
        set({
          isLoggedIn: false,
          user: null,
          session: null,
          isLoading: false,
        })
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
      set({
        isLoggedIn: false,
        user: null,
        session: null,
        isLoading: false,
      })
    }
  },

  /**
   * Register a new user
   */
  register: async (data) => {
    // Validation
    if (!data.email || !data.password || !data.name || !data.country) {
      return { success: false, message: 'All fields are required' }
    }

    if (!data.email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address' }
    }

    if (data.password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters' }
    }

    try {
      // Register with Supabase Auth
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.name,
            country: data.country,
          },
        },
      })

      if (error) {
        // Handle specific Supabase errors
        if (error.message.includes('already registered')) {
          return { success: false, message: 'An account with this email already exists' }
        }
        return { success: false, message: error.message }
      }

      if (!authData.user) {
        return { success: false, message: 'Registration failed - no user data returned' }
      }

      // Check if email confirmation is required
      if (authData.session) {
        // Auto-login successful (email confirmation disabled)
        const user: AuthUser = {
          id: authData.user.id,
          email: authData.user.email!,
          name: data.name,
          country: data.country,
        }

        set({
          isLoggedIn: true,
          user,
          session: authData.session,
        })

        return { success: true }
      } else {
        // Email confirmation required
        return {
          success: true,
          message: 'Registration successful! Please check your email to verify your account.',
        }
      }
    } catch (error) {
      console.error('Registration error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during registration'
      return {
        success: false,
        message: errorMessage,
      }
    }
  },

  /**
   * Login with email and password
   */
  login: async (email: string, password: string) => {
    // Validation
    if (!email || !password) {
      return { success: false, message: 'Email and password are required' }
    }

    if (!email.includes('@')) {
      return { success: false, message: 'Please enter a valid email address' }
    }

    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters' }
    }

    try {
      // Sign in with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        // Handle specific errors
        if (error.message.includes('Invalid login credentials')) {
          return { success: false, message: 'Invalid email or password' }
        }
        return { success: false, message: error.message }
      }

      if (!data.session) {
        return { success: false, message: 'Login failed - no session created' }
      }

      // Login successful
      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.name || data.user.user_metadata?.full_name,
        country: data.user.user_metadata?.country,
      }

      set({
        isLoggedIn: true,
        user,
        session: data.session,
      })

      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during login'
      return {
        success: false,
        message: errorMessage,
      }
    }
  },

  /**
   * Logout the current user
   */
  logout: async () => {
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('Logout error:', error)
      }

      // Clear state
      set({
        isLoggedIn: false,
        user: null,
        session: null,
      })

      // Small delay to ensure state syncs before navigation
      await new Promise((resolve) => setTimeout(resolve, 150))
    } catch (error) {
      console.error('Logout error:', error)
      // Clear state anyway
      set({
        isLoggedIn: false,
        user: null,
        session: null,
      })
    }
  },

  /**
   * Get the current access token (JWT)
   * Used for authenticated API requests to the Go backend
   */
  getAccessToken: async () => {
    const { session } = get()
    if (!session) {
      return null
    }

    // Check if token is still valid
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at && session.expires_at < now) {
      // Token expired, try to refresh
      const {
        data: { session: newSession },
      } = await supabase.auth.refreshSession()
      if (newSession) {
        set({ session: newSession })
        return newSession.access_token
      }
      return null
    }

    return session.access_token
  },
}))

// Set up auth state change listener
// This will automatically update the store when auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event)

  if (event === 'SIGNED_IN' && session) {
    // User signed in
    const user: AuthUser = {
      id: session.user.id,
      email: session.user.email!,
      name: session.user.user_metadata?.name || session.user.user_metadata?.full_name,
      country: session.user.user_metadata?.country,
    }

    useAuthStore.setState({
      isLoggedIn: true,
      user,
      session,
    })
  } else if (event === 'SIGNED_OUT') {
    // User signed out
    useAuthStore.setState({
      isLoggedIn: false,
      user: null,
      session: null,
    })
  } else if (event === 'TOKEN_REFRESHED' && session) {
    // Token was refreshed
    useAuthStore.setState({
      session,
    })
  }
})
