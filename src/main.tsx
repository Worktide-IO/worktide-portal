import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';

import App from '@/App';
import '@/index.css';
import { BrandingProvider } from '@/providers/brandingProvider';
import { applyBranding, readCachedBranding } from '@/lib/branding';

declare global {
  interface Window {
    __wtAppMounted?: () => void;
  }
}

// Apply the last-known branding (colors + title) before first paint so a
// white-labeled portal never flashes stock Worktide colors. The
// BrandingProvider revalidates against the API once mounted.
applyBranding(readCachedBranding());

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
