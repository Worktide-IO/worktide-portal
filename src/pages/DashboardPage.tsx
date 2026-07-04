import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Server, Ticket } from 'lucide-react';

import { portalApi, type PortalDashboard } from '@/lib/portal';

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
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-500">Überblick über Ihre Projekte und Systeme.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
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

        {data.systems ? (
          <Link
            to="/monitoring"
            className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300"
          >
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Server className="size-4" /> Systeme
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {data.systems.active}
              <span className="text-lg text-slate-400"> / {data.systems.total}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">aktiv</div>
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
    </div>
  );
}
