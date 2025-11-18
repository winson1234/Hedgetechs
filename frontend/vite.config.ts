import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Use localhost for development, Fly.io for production preview
const isDev = process.env.NODE_ENV !== 'production'

// Check if running in Docker (via environment variable)
const isDockerEnv = !!process.env.VITE_DOCKER_BACKEND_URL

// Check for mkcert-generated SSL certificates (for local HTTPS development)
const certPath = path.resolve(__dirname, '..', 'localhost+2.pem')
const keyPath = path.resolve(__dirname, '..', 'localhost+2-key.pem')
const hasCertificates = fs.existsSync(certPath) && fs.existsSync(keyPath)

// Determine backend URL based on environment
let BACKEND_URL: string
if (isDockerEnv) {
  // Docker mode: use Docker service name
  BACKEND_URL = process.env.VITE_DOCKER_BACKEND_URL!
} else if (isDev) {
  // Local development: use HTTPS if certificates are available
  BACKEND_URL = hasCertificates ? 'https://localhost:8080' : 'http://localhost:8080'
} else {
  // Production: use Fly.io URL
  BACKEND_URL = 'https://brokerageproject.fly.dev'
}

// Log configuration for developer visibility
if (isDockerEnv) {
  console.log('🐳 Running in Docker environment')
  console.log('   Frontend: http://localhost:5173')
  console.log('   Backend:  ' + BACKEND_URL)
} else if (isDev && hasCertificates) {
  console.log('✅ mkcert certificates found - using HTTPS for local development')
  console.log('   Frontend: https://localhost:5173')
  console.log('   Backend:  https://localhost:8080')
} else if (isDev) {
  console.log('ℹ️  No mkcert certificates found - using HTTP for local development')
  console.log('   Frontend: http://localhost:5173')
  console.log('   Backend:  http://localhost:8080')
  console.log('   Tip: Run "mkcert localhost 127.0.0.1 ::1" in project root for HTTPS')
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Load .env file from parent directory (project root)
  envDir: path.resolve(__dirname, '..'),
  // Build optimizations for production
  build: {
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and faster initial load
        manualChunks: {
          // Vendor chunks - rarely change, can be cached long-term
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'redux-vendor': ['@reduxjs/toolkit', 'react-redux', 'redux-persist'],
          'ui-vendor': ['framer-motion', 'gsap', 'lenis'],
          'chart-vendor': ['lightweight-charts', 'recharts'],
          'stripe-vendor': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
    // Increase chunk size warning limit (we're intentionally splitting)
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging (optional)
    sourcemap: false,
  },
  server: {
    port: 5173,
    // Enable HTTPS if certificates are available and not in Docker
    ...(!isDockerEnv && hasCertificates && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    }),
    proxy: {
      // Proxy REST API calls to backend
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false // Allow self-signed certificates
      },
      // Proxy websocket endpoint to backend
      '/ws': {
        target: BACKEND_URL.replace('http', 'ws').replace('https', 'wss'),
        ws: true,
        changeOrigin: true,
        secure: false // Allow self-signed certificates
      }
    }
  }
})
