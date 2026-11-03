import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Amb `npm run dev`, /api es redirigeix a l'API local (docker compose up db api).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
      // Fotos pujades pels venedors: en desenvolupament les serveix l'API.
      '/uploads': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
