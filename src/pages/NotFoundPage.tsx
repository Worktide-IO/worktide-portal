import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';

import { BrandMark } from '@/components/BrandMark';
import { Footer } from '@/components/Footer';

/**
 * Branded 404 for unknown portal routes. Standalone (no PortalLayout/nav) — an
 * unknown URL may be hit while unauthenticated, so it stays self-contained and
 * just offers a link back to the overview instead of the previous silent
 * redirect to /tickets.
 */
export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center">
      <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <BrandMark />
      </span>
      <p className="text-7xl font-bold tracking-tight text-slate-300">404</p>
      <h1 className="text-xl font-semibold text-slate-900">{t('not_found.title')}</h1>
      <p className="max-w-sm text-sm text-slate-600">{t('not_found.description')}</p>
      <Link
        to="/tickets"
        className="rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white"
      >
        {t('not_found.back_home')}
      </Link>
      <Footer />
    </div>
  );
}
