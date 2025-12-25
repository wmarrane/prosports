import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    server: {
      proxy: {
          '/api': 'http://192.168.56.125:3000'
      }
    },
  plugins: [react()],
})
