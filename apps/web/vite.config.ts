import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://api:3001',
        changeOrigin: true,
      },
    },
  },
});
