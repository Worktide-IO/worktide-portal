import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';

import { consumeMagicLink } from '@/providers/authProvider';
import { Footer } from '@/components/Footer';

/**
 * Landing page for a magic-login link (`/auth/magic?token=…`). Spends the
 * single-use token via POST /v1/auth/magic-link/consume, then drops into the
 * portal. Today this is how staff preview the portal AS a customer — on success
 * we stash the impersonation context so {@link ImpersonationBanner} can warn
 * "you are viewing as …".
 *
 * The token is single-use, so we guard against React StrictMode's double-invoke
 * (which would spend it twice — the second call 400s) with a ref.
 */
export function MagicLinkCallbackPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setError(t('magic.no_token'));
      return;
    }
    consumeMagicLink(token)
      .then((info) => {
        sessionStorage.setItem('portalImpersonation', JSON.stringify(info));
        navigate('/tickets', { replace: true });
      })
      .catch(() => setError(t('magic.error_invalid_link')));
  }, [token, navigate, t]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-3 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{t('magic.title')}</h1>
        {error ? (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <a href="/login" className="text-sm text-[var(--brand-primary)] underline">
              {t('magic.back_to_login')}
            </a>
          </>
        ) : (
          <p className="text-sm text-slate-500">{t('magic.signing_in')}</p>
        )}
      </div>
      <Footer />
    </div>
  );
}
