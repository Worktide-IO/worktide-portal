import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Standalone customer-portal SPA. Talks only to the worktide backend's
// /v1/portal/* + /v1/auth/* endpoints (see docs/PLAN.md). In dev it runs inside
// a DDEV web container behind nginx (see .ddev/); nginx proxies everything to
// this Vite server, and Vite proxies /v1 → the backend so requests stay
// same-origin (no CORS). Production points VITE_API_BASE at the real API host.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    // Vite blocks unknown Host headers by default — allow the ddev domains.
    allowedHosts: ['.ddev.site', 'localhost'],
    // HMR runs over the HTTPS port the ddev-router exposes, on the portal's
    // canonical host (matches the backend's PORTAL_BASE_URL set-password link).
    hmr: {
      protocol: 'wss',
      host: 'worktide-portal.ddev.site',
      clientPort: 443,
    },
    // Same-origin /v1 proxy to the Symfony backend (mkcert cert, host-routed).
    proxy: {
      '/v1': {
        target: 'https://api.worktide.ddev.site',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
