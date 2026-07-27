import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Standalone customer-portal SPA. Talks only to the worktide backend's
// /v1/portal/* + /v1/auth/* endpoints (see docs/PLAN.md). In dev it runs inside
// a DDEV web container behind nginx (see .ddev/); nginx proxies everything to
// this Vite server, and Vite proxies /v1 → the backend so requests stay
// same-origin (no CORS). Production points VITE_API_BASE at the real API host.
export default defineConfig(({ mode }) => {
  // Dev-only server/proxy targets. These MUST NOT be hardcoded — the file is
  // shared verbatim across every white-label instance (worktide, worktide-intewa,
  // …), and hardcoding one instance's ddev hostnames turned this file into a
  // permanent local diff that snagged every `git rebase`. Instead we derive the
  // hosts from DDEV_SITENAME (which ddev injects into the web container: it is
  // the ddev project name, e.g. "worktide" upstream, "worktide-intewa" here) and
  // allow explicit VITE_DEV_* overrides via a gitignored .env.local. No override
  // and no ddev ⇒ the upstream "worktide" defaults, so the committed file just
  // works everywhere with an empty working tree.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const site = env.DDEV_SITENAME || 'worktide';
  const portalHost = env.VITE_DEV_PORTAL_HOST || `${site}-portal.ddev.site`;
  const apiTarget = env.VITE_DEV_API_TARGET || `https://api.${site}.ddev.site`;
  // Mercure differs per instance and does NOT follow the sitename pattern: the
  // base instance points at the shared external hub, local instances at their
  // own ddev mercure service. Default preserves upstream; instances override via
  // VITE_DEV_MERCURE_TARGET in .env.local.
  const mercureTarget =
    env.VITE_DEV_MERCURE_TARGET || 'https://worktide-mercure.wappler.systems';

  return {
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
        host: portalHost,
        clientPort: 443,
      },
      // Same-origin /v1 proxy to the Symfony backend (mkcert cert, host-routed).
      proxy: {
        '/v1': {
          target: apiTarget,
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
          target: mercureTarget,
          changeOrigin: true,
          secure: false,
          ws: false,
        },
      },
    },
  };
});
