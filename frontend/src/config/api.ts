/**
 * API Configuration
 * Handles base URL for API requests in development vs production
 */

// Determine if we're in development or production
const isDev = import.meta.env.DEV

// Backend API base URL
export const API_BASE_URL = isDev
  ? '' // In dev, use relative paths (Vite proxy handles routing to localhost:8080)
  : 'https://brokerageproject.fly.dev' // In production, point directly to Fly.io

/**
 * Helper function to construct full API URLs
 * @param path - API path (e.g., '/api/v1/news')
 * @returns Full URL for the API endpoint
 */
export function getApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}
