import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';

import { portalApi, type PortalTicket } from '@/lib/portal';

export function TicketsListPage() {
  const [tickets, setTickets] = useState<PortalTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi
      .tickets()
      .then(setTickets)
      .catch(() => setError('Tickets konnten nicht geladen werden.'));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Meine Tickets</h1>
        <Link
          to="/tickets/new"
          className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="size-4" /> Neues Ticket
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {tickets === null && !error ? <p className="text-sm text-slate-500">Lädt…</p> : null}
      {tickets && tickets.length === 0 ? (
        <p className="text-sm text-slate-500">Noch keine Tickets.</p>
      ) : null}

      <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {(tickets ?? []).map((t) => (
          <li key={t.id}>
            <Link to={`/tickets/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-slate-500">{t.projectName}</div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{t.statusLabel}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
