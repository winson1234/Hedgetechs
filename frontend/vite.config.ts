import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Use localhost for development, Render for production preview
const isDev = process.env.NODE_ENV !== 'production'
const BACKEND_URL = isDev ? 'http://localhost:8080' : 'https://brokerageproject.onrender.com'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Load .env file from parent directory (project root)
  envDir: path.resolve(__dirname, '..'),
  server: {
    port: 5173,
    proxy: {
      // Proxy REST API calls to backend
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false
      },
      // Proxy websocket endpoint to backend
      '/ws': {
        target: BACKEND_URL.replace('http', 'ws').replace('https', 'wss'),
        ws: true,
        changeOrigin: true
      }
    }
  }
})
