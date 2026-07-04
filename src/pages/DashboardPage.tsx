import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Clock, Server, Ticket, Wallet } from 'lucide-react';

import { portalApi, type PortalDashboard } from '@/lib/portal';

/** Minutes → German decimal hours, e.g. 1512 → "25,2". */
function hours(min: number): string {
  return (min / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/** ISO → short German relative time ("vor 20 Min.", "gestern", …). */
function relativeTime(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'gestern';
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export function DashboardPage() {
  const [data, setData] = useState<PortalDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .dashboard()
      .then(setData)
      .catch(() => setError('Dashboard konnte nicht geladen werden.'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Lädt…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Willkommen zurück, {data.customerName}</h1>
        <p className="text-sm text-slate-500">Überblick über alle laufenden Projekte &amp; Systeme.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/tickets"
          className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300"
        >
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Ticket className="size-4" /> Offene Tickets
          </div>
          <div className="mt-2 text-3xl font-semibold">{data.openTickets.total}</div>
          <div className="mt-1 text-xs text-slate-500">
            {data.openTickets.highPriority} mit hoher Priorität
          </div>
        </Link>

        {data.budget ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Wallet className="size-4" /> Budget diesen Monat
            </div>
            <div className="mt-2 text-3xl font-semibold">{data.budget.pct} %</div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${data.budget.pct >= 100 ? 'bg-red-500' : data.budget.pct >= 85 ? 'bg-amber-500' : 'bg-slate-800'}`}
                style={{ width: `${Math.min(100, data.budget.pct)}%` }}
              />
            </div>
            <div className="mt-1.5 text-xs text-slate-500">
              {hours(data.budget.consumedMinutes)} / {hours(data.budget.budgetMinutes)} Std. verbraucht
            </div>
          </div>
        ) : null}

        {data.systems ? (
          <Link
            to="/monitoring"
            className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300"
          >
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Server className="size-4" /> System-Status
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {data.systems.active}
              <span className="text-lg text-slate-400"> / {data.systems.total}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              aktiv
              {data.systems.openIncidents > 0
                ? ` · ${data.systems.openIncidents} ${data.systems.openIncidents === 1 ? 'Störung' : 'Störungen'}`
                : ' · keine Störungen'}
            </div>
          </Link>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Projektfortschritt</h2>
        {data.projects.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Projekte.</p>
        ) : (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            {data.projects.map((p) => (
              <div key={p.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-slate-500">{p.progressPct} %</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-800" style={{ width: `${p.progressPct}%` }} />
                </div>
                <div className="mt-1 text-xs text-slate-400">{p.openTasks} offene Aufgaben</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.blockers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <AlertTriangle className="size-4 text-amber-500" /> Blocker ({data.blockers.length})
          </h2>
          <ul className="divide-y divide-amber-100 rounded-lg border border-amber-200 bg-amber-50/60 p-2">
            {data.blockers.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/tickets/${b.id}`}
                  className="flex items-start gap-3 rounded-md px-2 py-2 transition hover:bg-amber-100/60"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-amber-700">{b.identifier}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{b.title}</span>
                    {b.projectName ? (
                      <span className="text-xs text-slate-500">{b.projectName}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.activity.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Clock className="size-4 text-slate-400" /> Aktivität
          </h2>
          <ul className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            {data.activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" />
                <div className="min-w-0 flex-1">
                  <span className="text-slate-700">
                    {a.label}
                    {a.ticketIdentifier ? (
                      <>
                        {' · '}
                        <span className="font-mono text-xs text-slate-500">{a.ticketIdentifier}</span>
                        {a.ticketTitle ? <span className="text-slate-500"> {a.ticketTitle}</span> : null}
                      </>
                    ) : null}
                  </span>
                  <div className="text-xs text-slate-400">
                    {a.actor} · {relativeTime(a.occurredAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
