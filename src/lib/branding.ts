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
  primaryColor: string;
  accentColor: string;
  imprintUrl: string;
  privacyUrl: string;
  supportEmail: string;
};

/** Stock Worktide look — used before the fetch resolves and as a fallback. */
export const DEFAULT_BRANDING: Branding = {
  name: 'Worktide',
  legalName: 'Worktide',
  logoUrl: '',
  logoUrlDark: '',
  primaryColor: '#0F8C72',
  accentColor: '#E0623A',
  imprintUrl: '',
  privacyUrl: '',
  supportEmail: '',
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
