import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { setPassword } from '@/providers/authProvider';
import { Footer } from '@/components/Footer';

/**
 * Landing page for the "set your password" email link sent when staff grant a
 * contact portal access. The token comes from the URL (?token=…) and is spent
 * via POST /v1/auth/reset-password.
 */
export function SetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await setPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1200);
    } catch {
      setError('Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Passwort festlegen</h1>
        {!token ? (
          <p className="text-sm text-red-600">Kein Token im Link gefunden.</p>
        ) : done ? (
          <p className="text-sm text-green-700">Passwort gesetzt. Weiterleitung zur Anmeldung…</p>
        ) : (
          <>
            <label className="block text-sm">
              Neues Passwort
              <input
                type="password"
                value={password}
                onChange={(e) => setPw(e.target.value)}
                required
                minLength={10}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <p className="text-xs text-slate-500">Mindestens 10 Zeichen (Backend-Policy).</p>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button type="submit" className="w-full cursor-pointer rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white">
              Passwort speichern
            </button>
          </>
        )}
      </form>
      <Footer />
    </div>
  );
}
