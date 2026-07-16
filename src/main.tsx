import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from '@/App';
import '@/index.css';
import '@/i18n'; // initialise i18next before the app renders
import { BrandingProvider } from '@/providers/brandingProvider';
import { applyBranding, readCachedBranding } from '@/lib/branding';
import { logVersionDiagnostics } from '@/lib/version';
import { installDiagnostics } from '@/lib/diagnostics';
import { installFeedbackQueueDrainers } from '@/lib/feedbackQueue';

declare global {
  interface Window {
    __wtAppMounted?: () => void;
  }
}

// Apply the last-known branding (colors + title) before first paint so a
// white-labeled portal never flashes stock Worktide colors. The
// BrandingProvider revalidates against the API once mounted.
applyBranding(readCachedBranding());

// One-time console diagnostics: log the portal build + the API build and warn
// on a mismatch (stale SPA against a newer API).
logVersionDiagnostics();

// Capture client-side diagnostics for the feedback tool + replay any feedback
// reports queued while offline. Both run before React mounts.
installDiagnostics();
installFeedbackQueueDrainers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <App />
      </BrandingProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Signal the blank-page recovery guard in index.html that the app mounted,
// so it clears the reload counter and the watchdog stands down.
window.__wtAppMounted?.();
