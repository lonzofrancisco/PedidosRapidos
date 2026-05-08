import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En dev: proxy /api -> backend (localhost:3000 fuera de docker, o api:3000 dentro)
const API_TARGET = process.env.VITE_API_PROXY || 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
