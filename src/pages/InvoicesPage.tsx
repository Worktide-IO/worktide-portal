import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt } from 'lucide-react';

import { intlLocale, formatDate } from '@/lib/intl';
import { portalApi, type PortalInvoice } from '@/lib/portal';

// Dedicated "Rechnungen" screen (wireframe screen 4). Read-only list of the
// customer's invoices mirrored from lexoffice, feature-gated by `invoices`
// (the sidebar entry only links here when the flag is on). Moved out of the
// Agreements page so billing has its own tab, matching the wireframe.

const STATUS_CLASSES: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  open: 'bg-amber-100 text-amber-800',
  overdue: 'bg-red-100 text-red-700',
  voided: 'bg-slate-100 text-slate-500',
};

function formatPrice(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(intlLocale(), { style: 'currency', currency: currency.toUpperCase() }).format(
      cents / 100,
    );
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function InvoicesPage() {
  const { t } = useTranslation();
  const [invoices, setInvoices] = useState<PortalInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .invoices()
      .then(setInvoices)
      .catch(() => setError(t('invoices.error_load_failed')));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!invoices) return <p className="text-sm text-slate-500">{t('app.loading')}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('invoices.page_title')}</h1>
        <p className="text-sm text-slate-500">{t('invoices.page_subtitle')}</p>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-slate-500">{t('invoices.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Receipt className="size-4 shrink-0 text-slate-400" />
                  <span className="font-mono text-xs text-slate-500">{inv.number}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {formatDate(inv.issuedOn, { dateStyle: 'medium' })}
                  {inv.dueOn ? ` · ${t('invoices.due', { date: formatDate(inv.dueOn, { dateStyle: 'medium' }) })}` : ''}
                  {inv.openCents !== null && inv.openCents > 0 && inv.status !== 'paid'
                    ? ` · ${t('invoices.open_amount', { amount: formatPrice(inv.openCents, inv.currency) })}`
                    : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[inv.status] ?? STATUS_CLASSES.open}`}
                >
                  {inv.statusLabel}
                </span>
                <span
                  className={`tabular-nums text-sm font-medium ${inv.status === 'voided' ? 'text-slate-400 line-through' : ''}`}
                >
                  {formatPrice(inv.totalCents, inv.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
