import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Use localhost for development, Fly.io for production preview
const isDev = process.env.NODE_ENV !== 'production'

// Check for mkcert-generated SSL certificates (for local HTTPS development)
const certPath = path.resolve(__dirname, '..', 'localhost+2.pem')
const keyPath = path.resolve(__dirname, '..', 'localhost+2-key.pem')
const hasCertificates = fs.existsSync(certPath) && fs.existsSync(keyPath)

// Use HTTPS for local development if certificates are available
const BACKEND_URL = isDev
  ? (hasCertificates ? 'https://localhost:8080' : 'http://localhost:8080')
  : 'https://brokerageproject.fly.dev'

// Log configuration for developer visibility
if (isDev && hasCertificates) {
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
  server: {
    port: 5173,
    // Enable HTTPS if certificates are available
    ...(hasCertificates && {
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
