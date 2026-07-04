import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Standalone customer-portal SPA. Talks only to the worktide backend's
// /v1/portal/* + /v1/auth/* endpoints (see docs/PLAN.md). Served on its own
// domain in production; in dev, VITE_API_BASE points at the local API.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: '0.0.0.0', port: 5174 },
});
