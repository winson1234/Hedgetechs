import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      },
      // Proxy websocket endpoint to backend
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  }
})
