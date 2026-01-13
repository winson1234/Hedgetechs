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
  phone_number?: string;
  country?: string;
  profile_picture?: string;
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
  user_type: string;
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
      // Throw the full result object to preserve error codes
      // But ensure it has a message property for standard error handling
      const errorPayload = {
        ...result,
        message: result.message || result.error || 'Login failed',
      };
      throw errorPayload;
    }

    // Store token in sessionStorage (cleared when tab closes)
    if (result.token) {
      sessionStorage.setItem('auth_token', result.token);
    }

    return result as AuthResponse;
  } catch (error: any) {
    // If it's already a structured error object from above (with message/code), re-throw it.
    if (error && (error.error || error.code || error.message)) {
      throw error;
    }
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

/**
 * Update user profile
 */
export interface UpdateProfileRequest {
  first_name: string;
  last_name: string;
  phone_number: string;
  country: string;
  profile_picture?: string;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<{ success: boolean; message: string; user: User }> {
  try {
    const token = getToken();
    if (!token) throw new Error('No authentication token found');

    const response = await fetch(getApiUrl('/api/v1/user/profile'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Profile update failed');
    }

    // Update stored user data
    if (result.user) {
      storeUser({ ...getStoredUser(), ...result.user });
    }

    return {
      success: true,
      message: result.message || 'Profile updated successfully',
      user: result.user
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Profile update failed');
  }
}

/**
 * Get user profile
 */
export async function getProfile(): Promise<{ user: User }> {
  try {
    const token = getToken();
    if (!token) throw new Error('No authentication token found');

    const response = await fetch(getApiUrl('/api/v1/user/profile'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    const user = await response.json();

    if (!response.ok) {
      throw new Error(user.message || user.error || 'Failed to fetch profile');
    }

    // Update stored user data
    if (user) {
      storeUser({ ...getStoredUser(), ...user });
    }

    return { user };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to fetch profile');
  }
}
