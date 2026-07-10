import { api, getAccessToken, refreshSession, setAccessToken } from '@/lib/api';
import { clearMercureToken } from '@/lib/mercure';

/**
 * Password login for portal contacts. The backend issues a JWT (carrying
 * ROLE_PORTAL) via the SAME endpoint as staff — the difference is the account's
 * roles, which the backend firewall uses to restrict portal users to
 * /v1/portal/* (see docs/PLAN.md, "Firewall-Lockdown").
 *
 * Auth model (M1): the refresh token is an httpOnly cookie; the access token is
 * held in memory only. On load, ensureAuthenticated() silently refreshes from
 * the cookie so a reload restores the session (RequireAuth awaits it).
 *
 * The initial password is set via the email link from the staff "grant portal
 * access" action → POST /v1/auth/reset-password (see SetPasswordPage).
 */
export async function login(email: string, password: string): Promise<void> {
  const { data } = await api.post<{ token: string }>('/auth/login', { email, password });
  setAccessToken(data.token); // in-memory; the refresh cookie is set by the response
}

export async function logout(): Promise<void> {
  try {
    // Bearer still in memory here → the request authenticates; the server clears
    // the httpOnly cookie + revokes the refresh token.
    await api.post('/auth/logout', {});
  } catch {
    // even if revocation fails, drop the local session
  }
  setAccessToken(null);
  // Drop the cached hub JWT — it's scoped to this user's topic, so a
  // login-as-different-user must not reuse it for its 30-minute lifetime.
  clearMercureToken();
}

/**
 * Resolve auth for a route guard: true if an access token is already in memory,
 * else attempt a silent refresh from the httpOnly cookie (session restore on
 * load/reload). Single-flight via refreshSession().
 */
export function ensureAuthenticated(): Promise<boolean> {
  return getAccessToken() !== null ? Promise.resolve(true) : refreshSession();
}

export async function setPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}
