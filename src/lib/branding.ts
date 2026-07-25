import { API_BASE } from '@/lib/api';

/**
 * White-label branding for the customer portal, fetched at runtime from the
 * backend's public GET /v1/branding endpoint (same source as the staff SPA and
 * system emails). Colors are applied by overriding --brand-primary /
 * --brand-accent on :root; logo, name and legal links are read via useBranding().
 * An operator rebrands by setting BRAND_* env — no portal rebuild needed.
 */
export type Branding = {
  name: string;
  legalName: string;
  logoUrl: string;
  logoUrlDark: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  imprintUrl: string;
  privacyUrl: string;
  supportEmail: string;
  /** When true, a thin red demo banner is shown across the top of every page. */
  demoMode: boolean;
  /** Optional custom banner label; empty → the portal's default text. */
  demoBannerText: string;
};

/** Stock Worktide look — used before the fetch resolves and as a fallback. */
export const DEFAULT_BRANDING: Branding = {
  name: 'Worktide',
  legalName: 'Worktide',
  logoUrl: '',
  logoUrlDark: '',
  faviconUrl: '',
  primaryColor: '#0F8C72',
  accentColor: '#E0623A',
  imprintUrl: '',
  privacyUrl: '',
  supportEmail: '',
  demoMode: false,
  demoBannerText: '',
};

const CACHE_KEY = 'wtp.branding';

/** Read the last-applied branding for a flash-free first paint. */
export function readCachedBranding(): Branding {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      return { ...DEFAULT_BRANDING, ...(JSON.parse(raw) as Partial<Branding>) };
    }
  } catch {
    /* ignore malformed cache */
  }
  return DEFAULT_BRANDING;
}

/**
 * Apply branding to the document: override the brand-color CSS variables and
 * set the tab title. Idempotent — safe to call with the cached value on boot
 * and again after the network fetch resolves.
 */
export function applyBranding(b: Branding): void {
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primaryColor);
  root.style.setProperty('--brand-accent', b.accentColor);
  document.title = b.name;

  applyFavicon(b.faviconUrl);
}

/**
 * Swap the browser-tab favicon at runtime. Empty URL keeps the bundled icon.
 * Rewrites the primary <link rel="icon"> in place so an operator can rebrand the
 * tab icon via BRAND_FAVICON_URL without rebuilding the portal.
 */
function applyFavicon(url: string): void {
  if (!url) return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = url.endsWith('.svg') ? 'image/svg+xml' : '';
  link.href = url;
}

/** Fetch branding from the public endpoint, applying defaults for missing keys. */
export async function fetchBranding(): Promise<Branding> {
  const res = await fetch(`${API_BASE}/branding`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`branding fetch failed: ${res.status}`);
  const data = (await res.json()) as Partial<Branding>;
  const branding = { ...DEFAULT_BRANDING, ...data };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(branding));
  } catch {
    /* ignore quota / private-mode errors */
  }
  return branding;
}
