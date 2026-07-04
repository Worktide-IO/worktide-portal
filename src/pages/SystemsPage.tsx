import { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Server, Wrench } from 'lucide-react';

import { portalApi, type PortalSystem, type PortalSystemIncident } from '@/lib/portal';

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

// Live status slug → badge + dot colors.
const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  operational: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  degraded: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  down: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  maintenance: { badge: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  inactive: { badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' },
};

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.inactive;
}

// A daily uptime bar's color by that day's %.
function barColor(pct: number): string {
  if (pct >= 99.5) return 'bg-green-400';
  if (pct >= 98) return 'bg-amber-400';
  return 'bg-red-400';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** 30-bar uptime history. Oldest → newest, left → right. */
function UptimeSparkline({ days }: { days: PortalSystem['uptimeDays'] }) {
  if (days.length === 0) {
    return <p className="text-xs text-slate-400">Noch keine Verlaufsdaten.</p>;
  }
  return (
    <div className="flex items-end gap-0.5" title="Verfügbarkeit der letzten 30 Tage">
      {days.map((d) => (
        <span
          key={d.day}
          className={`h-6 flex-1 rounded-sm ${barColor(d.uptimePct)}`}
          style={{ opacity: 0.35 + (d.uptimePct / 100) * 0.65 }}
          title={`${formatDate(d.day)}: ${d.uptimePct}%`}
        />
      ))}
    </div>
  );
}

export function SystemsPage() {
  const [systems, setSystems] = useState<PortalSystem[] | null>(null);
  const [incidents, setIncidents] = useState<PortalSystemIncident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .systems()
      .then((d) => {
        setSystems(d.systems);
        setIncidents(d.incidents);
      })
      .catch(() => setError('Systeme konnten nicht geladen werden.'));
  }, []);

  const openIncidents = incidents.filter((i) => i.open);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Monitoring</h1>
        <p className="text-sm text-slate-500">Verfügbarkeit, Antwortzeiten und Störungen Ihrer Systeme.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {systems === null && !error ? <p className="text-sm text-slate-500">Lädt…</p> : null}
      {systems && systems.length === 0 ? (
        <p className="text-sm text-slate-500">Keine Systeme hinterlegt.</p>
      ) : null}

      {openIncidents.length > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="size-4 shrink-0" />
          {openIncidents.length === 1
            ? '1 System hat aktuell eine Störung.'
            : `${openIncidents.length} Systeme haben aktuell eine Störung.`}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(systems ?? []).map((s) => {
          const style = statusStyle(s.status);
          return (
            <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Server className="size-4 shrink-0 text-slate-400" />
                  <span className="truncate font-medium">{s.name}</span>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}
                >
                  <span className={`size-1.5 rounded-full ${style.dot}`} />
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

              {s.uptimePct !== null ? (
                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-slate-700">{s.uptimePct}%</span>
                    <span className="text-xs text-slate-400">
                      Ø {s.avgResponseMs !== null ? `${s.avgResponseMs} ms` : '—'} · 30 Tage
                    </span>
                  </div>
                  <UptimeSparkline days={s.uptimeDays} />
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-400">Keine Verfügbarkeitsdaten.</p>
              )}

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
          );
        })}
      </div>

      {incidents.length > 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-700">Vorfälle & Wartung</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {incidents.map((i) => {
              const isMaintenance = i.kind === 'maintenance';
              return (
                <li key={i.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span
                    className={`mt-0.5 shrink-0 ${isMaintenance ? 'text-sky-500' : i.open ? 'text-red-500' : 'text-slate-400'}`}
                  >
                    {isMaintenance ? <Wrench className="size-4" /> : <AlertTriangle className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{i.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          i.open ? statusStyle(isMaintenance ? 'maintenance' : 'down').badge : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {i.open ? i.kindLabel : 'Behoben'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {i.systemName} · {formatDate(i.startedAt)}
                      {i.resolvedAt ? ` – ${formatDate(i.resolvedAt)}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
