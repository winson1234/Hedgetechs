/**
 * API Utility
 * Handles API base URL configuration for different environments
 */

// Get API base URL from environment variable
// Falls back to relative path for local development
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Constructs full API URL
 * @param path - API endpoint path (e.g., '/api/v1/accounts')
 * @returns Full URL to API endpoint
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  if (API_BASE_URL) {
    // Use configured API URL (production/dev deployments)
    return `${API_BASE_URL}/${cleanPath}`;
  } else {
    // Use relative URL (local development)
    return `/${cleanPath}`;
  }
}

/**
 * Enhanced fetch with automatic API URL resolution and JWT token injection
 * @param path - API endpoint path
 * @param options - Fetch options
 * @returns Fetch promise
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getApiUrl(path);

  // Get JWT token from sessionStorage
  const token = sessionStorage.getItem('auth_token');

  // Inject Authorization header if token exists
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Merge headers back into options
  const enhancedOptions: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, enhancedOptions);

  // Interceptor: Handle 401 Unauthorized (Token Expired)
  if (response.status === 401) {
    sessionStorage.removeItem('auth_token');
    // Save current path for redirect after login (optional)
    sessionStorage.setItem('redirect_after_login', window.location.pathname);
    // Force redirect to login
    window.location.href = '/login';
  }

  return response;
}

// Export API_BASE_URL for debugging
export { API_BASE_URL };
