import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Vite config — host 0.0.0.0 so the preview proxy can reach the dev server.
// allowedHosts: true lets the proxied preview domain through.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: { '/api': 'http://127.0.0.1:8000', '/media': 'http://127.0.0.1:8000' },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: { '/api': 'http://127.0.0.1:8000', '/media': 'http://127.0.0.1:8000' },
  },
});
