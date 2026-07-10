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

// Resilience: a JSON endpoint should never hand a component a raw string. In
// dev the Symfony profiler can append an error page after the JSON (a corrupt
// var/cache Deprecations.log → "headers already sent"), so axios fails to parse
// and returns the raw body. Salvage the leading JSON object (it ends exactly
// where the appended "<!-- … -->" / HTML begins); reject if unsalvageable — so
// callers hit their catch/error state instead of crashing on `data.foo`.
api.interceptors.response.use((response) => {
  if (typeof response.data === 'string' && response.data.length > 0) {
    const cut = response.data.indexOf('<!--');
    const jsonPart = (cut >= 0 ? response.data.slice(0, cut) : response.data).trim();
    if (jsonPart === '') return response;
    try {
      response.data = JSON.parse(jsonPart);
    } catch {
      return Promise.reject(new Error('Malformed (non-JSON) response'));
    }
  }
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
