import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Så du kan nå den från nätverket
    port: 5175,
    allowedHosts: [
      'qwicky.xerious.org' // Tillåter anslutningar från din Cloudflare-domän
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})