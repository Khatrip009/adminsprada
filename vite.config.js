// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',           
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4200',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/api/events': {
        target: 'http://localhost:4200',
        changeOrigin: true,
        ws: true
      },

      // <-- ADD THIS
      '/uploads': {
        target: 'http://localhost:4200',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/uploads/, '/uploads')
      }
    }
  }
});
