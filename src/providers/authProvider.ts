import { api, clearTokens, readToken, writeTokens, JWT_KEY } from '@/lib/api';

/**
 * Password login for portal contacts. The backend issues a JWT (carrying
 * ROLE_PORTAL) via the SAME endpoint as staff — the difference is the account's
 * roles, which the backend firewall uses to restrict portal users to
 * /v1/portal/* (see docs/PLAN.md, "Firewall-Lockdown").
 *
 * The initial password is set via the email link from the staff "grant portal
 * access" action → POST /v1/auth/reset-password (see SetPasswordPage).
 */
export async function login(email: string, password: string): Promise<void> {
  const { data } = await api.post<{ token: string; refresh_token: string }>('/auth/login', {
    email,
    password,
  });
  writeTokens(data.token, data.refresh_token);
}

export function logout(): void {
  clearTokens();
}

export function isAuthenticated(): boolean {
  return readToken(JWT_KEY) !== null;
}

export async function setPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}
