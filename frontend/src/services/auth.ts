/**
 * Custom Authentication Service
 * 
 * Handles all authentication operations with the custom backend API.
 * Replaces Supabase Auth with JWT-based authentication.
 */

import { getApiUrl } from '../utils/api';

export interface User {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  country?: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  country: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CheckStatusResponse {
  status: 'pending' | 'approved' | 'rejected';
  message: string;
  pending_since?: string;
}

/**
 * Register a new user
 * Note: Registration creates a user account directly, no approval needed
 */
export async function register(data: RegisterRequest): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(getApiUrl('/api/v1/auth/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      // Extract error message from backend response
      const errorMessage = result.message || result.error || 'Registration failed';
      throw new Error(errorMessage);
    }

    return {
      success: true,
      message: result.message || 'Registration successful. You can now log in.',
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Registration failed');
  }
}

/**
 * Login with email and password
 * Returns JWT token and user data on success
 */
export async function login(data: LoginRequest): Promise<AuthResponse> {
  try {
    const response = await fetch(getApiUrl('/api/v1/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Login failed');
    }

    // Store token in sessionStorage (cleared when tab closes)
    if (result.token) {
      sessionStorage.setItem('auth_token', result.token);
    }

    return result as AuthResponse;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Login failed');
  }
}

/**
 * Logout current user
 * Clears JWT token from sessionStorage
 */
export async function logout(): Promise<void> {
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('user_data');
}

/**
 * Check registration status for pending accounts
 */
export async function checkStatus(email: string): Promise<CheckStatusResponse> {
  try {
    const response = await fetch(getApiUrl(`/api/v1/auth/check-status?email=${encodeURIComponent(email)}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Status check failed');
    }

    return result as CheckStatusResponse;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Status check failed');
  }
}

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  return sessionStorage.getItem('auth_token');
}

/**
 * Get stored user data
 */
export function getStoredUser(): User | null {
  const userData = sessionStorage.getItem('user_data');
  if (!userData) return null;

  try {
    return JSON.parse(userData) as User;
  } catch {
    return null;
  }
}

/**
 * Store user data in sessionStorage
 */
export function storeUser(user: User): void {
  sessionStorage.setItem('user_data', JSON.stringify(user));
}

/**
 * Validate current session by checking token and user data
 */
export async function validateSession(): Promise<{ user: User | null; isValid: boolean }> {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return { user: null, isValid: false };
  }

  // TODO: Optionally implement token validation endpoint
  // For now, just check if token exists
  return { user, isValid: true };
}
