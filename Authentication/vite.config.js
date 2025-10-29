import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.', // project root
  build: {
    rollupOptions: {
      input: {
        register: resolve(__dirname, 'register/register.html'),
        login: resolve(__dirname, 'login/login.html'),
        dashboard: resolve(__dirname, 'dashboard/dashboard.html')
      }
    }
  }
})
