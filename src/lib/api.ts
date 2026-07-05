import axios from 'axios';

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

// TODO(phase-1): on 401, try POST /auth/refresh with the refresh token and
// replay the request once (mirror worktide-web/src/providers/authProvider.ts),
// then fall back to logout. Kept minimal here so the auth flow is easy to read.
