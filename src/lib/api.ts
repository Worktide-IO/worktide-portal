import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE = import.meta.env.VITE_API_BASE ?? '/v1';

// Portal-only storage keys — deliberately distinct from the staff SPA's `wt.*`
// so a browser can hold both sessions without collision.
export const JWT_KEY = 'wtp.jwt';
export const REFRESH_KEY = 'wtp.refresh';

export function readToken(key: string): string | null {
  return localStorage.getItem(key);
}

export function writeTokens(jwt: string, refresh: string): void {
  localStorage.setItem(JWT_KEY, jwt);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const jwt = readToken(JWT_KEY);
  if (jwt && config.headers) config.headers.Authorization = `Bearer ${jwt}`;
  return config;
});

/**
 * Recover the leading JSON value from a string that has trailing garbage, by
 * string-aware bracket matching. Returns undefined if the text doesn't start
 * with a JSON object/array or the matched span won't parse. Crucially, brackets
 * and "<!--" *inside* string literals don't fool it — so a valid payload isn't
 * truncated at a "<!--" that merely appears in one of its own field values.
 */
function extractLeadingJson(text: string): unknown {
  const s = text.replace(/^\s+/, '');
  const open = s[0];
  if (open !== '{' && open !== '[') return undefined;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth += 1;
    else if (ch === close && (depth -= 1) === 0) {
      try {
        return JSON.parse(s.slice(0, i + 1));
      } catch {
        return undefined;
      }
    }
  }
  return undefined; // never balanced
}

// Resilience: a JSON endpoint should never hand a component a raw string. In dev
// the Symfony profiler can append an error page AFTER the JSON body (a corrupt
// var/cache Deprecations.log → "headers already sent"), so axios can't parse the
// whole body and leaves `response.data` a string. We only intervene for
// responses the server labelled JSON, and recover via balanced bracket matching
// — NOT by cutting at "<!--" (which truncated valid payloads containing "<!--"
// and missed notices like "<br /><b>Warning</b>" that carry no "<!--"). Reject
// if unsalvageable, so callers hit their error state instead of crashing on
// `data.foo`.
api.interceptors.response.use((response) => {
  if (typeof response.data !== 'string' || response.data.length === 0) return response;
  const h = response.headers as { get?: (k: string) => unknown; [k: string]: unknown } | undefined;
  const contentType = String((typeof h?.get === 'function' ? h.get('content-type') : h?.['content-type']) ?? '');
  if (!contentType.includes('json')) return response; // leave genuine text/html etc. alone
  // Fast path: the whole body is valid JSON (axios left it a string for some
  // unrelated reason) — parse and return, no salvage heuristics needed.
  try {
    response.data = JSON.parse(response.data);
    return response;
  } catch {
    // fall through to salvage
  }
  const salvaged = extractLeadingJson(response.data);
  if (salvaged === undefined) return Promise.reject(new Error('Malformed (non-JSON) response'));
  response.data = salvaged;
  return response;
});

// Single-flight refresh: concurrent 401s (a dashboard fires several requests at
// once) must trigger exactly one POST /auth/refresh, not one per request — the
// backend rotates the refresh token on every use, so parallel refreshes would
// race and invalidate each other. All callers await the same in-flight promise.
let refreshInflight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  const refresh = readToken(REFRESH_KEY);
  if (!refresh) return Promise.resolve(false);
  refreshInflight = (async () => {
    try {
      // Bare axios (not `api`) so the request interceptor doesn't attach the
      // stale Bearer, and so a 401 here can't recurse into this interceptor.
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refresh });
      if (!data?.token || !data?.refresh_token) return false;
      writeTokens(data.token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

// On 401: refresh once and replay the original request. If refresh fails (no
// token, revoked, expired) clear the session and bounce to /login — otherwise a
// stale JWT surfaces as a misleading "not found" in the calling component.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status !== 401 || !original || original._retried) {
      return Promise.reject(error);
    }
    original._retried = true;
    const ok = await refreshSession();
    if (!ok) {
      clearTokens();
      if (window.location.pathname !== '/login') window.location.assign('/login');
      return Promise.reject(error);
    }
    // The request interceptor re-reads JWT_KEY, so the replay carries the new token.
    return api(original);
  },
);
