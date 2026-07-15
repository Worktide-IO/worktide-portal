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
  // Stamp the build time into the bundle so lib/version.ts can report which
  // build is live (VITE_APP_VERSION / VITE_APP_COMMIT come in as env vars).
  define: {
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
      host: 'portal.worktide.ddev.site',
      clientPort: 443,
    },
    // Same-origin /v1 proxy to the Symfony backend (mkcert cert, host-routed).
    proxy: {
      '/v1': {
        target: 'https://api.worktide.ddev.site',
        changeOrigin: true,
        secure: false,
      },
      // Same-origin proxy to the Mercure hub for the live notification stream.
      // The shared hub's CORS allowlist doesn't include the portal's dev origin
      // (http://…:5174), so a direct EventSource is blocked by preflight.
      // Proxying keeps the SSE connection same-origin in dev; prod points
      // VITE_MERCURE_HUB_URL straight at the hub (whose CORS lists the real
      // portal domain). `ws:false` — this is SSE (a streamed HTTP response),
      // not a WebSocket.
      '/.well-known/mercure': {
        target: 'https://worktide-mercure.wappler.systems',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
    },
  },
});
