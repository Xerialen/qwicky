import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/qwicky/',  // <--- DETTA ÄR NYCKELN TILL LÖSNINGEN
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  }
});
