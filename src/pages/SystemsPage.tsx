import { useEffect, useState } from 'react';
import { ExternalLink, Server } from 'lucide-react';

import { portalApi, type PortalSystem } from '@/lib/portal';

// Internal type slug → display label.
const TYPE_LABELS: Record<string, string> = {
  typo3: 'TYPO3',
  wordpress: 'WordPress',
  drupal: 'Drupal',
  magento: 'Magento',
  shopware: 'Shopware',
  joomla: 'Joomla',
  symfony: 'Symfony',
  laravel: 'Laravel',
  static: 'Static',
  other: 'Andere',
};

export function SystemsPage() {
  const [systems, setSystems] = useState<PortalSystem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .systems()
      .then(setSystems)
      .catch(() => setError('Systeme konnten nicht geladen werden.'));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Monitoring</h1>
        <p className="text-sm text-slate-500">Ihre Systeme und deren Status.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {systems === null && !error ? <p className="text-sm text-slate-500">Lädt…</p> : null}
      {systems && systems.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Systeme hinterlegt.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(systems ?? []).map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Server className="size-4 shrink-0 text-slate-400" />
                <span className="truncate font-medium">{s.name}</span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  s.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {s.statusLabel}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded bg-slate-100 px-2 py-0.5">
                {TYPE_LABELS[s.type] ?? s.type}
                {s.systemVersion ? ` ${s.systemVersion}` : ''}
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5">{s.environmentLabel}</span>
              {s.hostingProvider ? (
                <span className="rounded bg-slate-100 px-2 py-0.5">{s.hostingProvider}</span>
              ) : null}
            </div>

            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
              >
                <ExternalLink className="size-3.5" />
                {s.url.replace(/^https?:\/\//, '')}
              </a>
            ) : null}
          </div>
        ))}
      </div>

      {systems && systems.length > 0 ? (
        <p className="pt-1 text-xs text-slate-400">
          Live-Verfügbarkeit, Antwortzeiten und Störungsverlauf folgen, sobald die
          Monitoring-Anbindung aktiv ist.
        </p>
      ) : null}
    </div>
  );
}
