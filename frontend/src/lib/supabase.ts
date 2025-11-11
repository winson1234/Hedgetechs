/**
 * Supabase Client Configuration
 *
 * This file initializes and exports the Supabase client for authentication
 * and database operations throughout the application.
 */

import { createClient } from '@supabase/supabase-js'

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate that environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure auth persistence
    persistSession: true,
    // Use localStorage for session persistence (survives page reloads)
    storage: window.localStorage,
    // Auto-refresh session before expiry
    autoRefreshToken: true,
    // Detect session from URL (for email confirmations, password resets, etc.)
    detectSessionInUrl: true,
  },
})

/**
 * Get the current JWT access token
 * Returns null if no active session
 */
export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

/**
 * Get the current user
 * Returns null if no active session
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
