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

// TODO(phase-1): on 401, try POST /auth/refresh with the refresh token and
// replay the request once (mirror worktide-web/src/providers/authProvider.ts),
// then fall back to logout. Kept minimal here so the auth flow is easy to read.
