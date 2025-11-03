import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// RENDER BACKEND URL
const RENDER_BACKEND_URL = 'https://brokerageproject.onrender.com'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Load .env file from parent directory (project root)
  envDir: path.resolve(__dirname, '..'),
  server: {
    port: 5173,
    proxy: {
      // Proxy REST API calls to Render backend
      '/api': {
        target: RENDER_BACKEND_URL,
        changeOrigin: true,
        secure: false
      },
      // Proxy websocket endpoint to Render backend (HTTPS -> WSS)
      '/ws': {
        target: RENDER_BACKEND_URL.replace('https', 'wss'),
        ws: true
      }
    }
  }
})
