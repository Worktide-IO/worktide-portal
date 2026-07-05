import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';

import { portalApi, type PortalTicket, type PortalTicketSla } from '@/lib/portal';
import { PriorityBadge } from '@/components/PriorityBadge';

const ALL = '__all__';
const WAITING = '__waiting__';

// SLA cell — shows the resolution target, colored by status. Hidden when none.
const SLA_STYLES: Record<string, string> = {
  due: 'text-slate-500',
  overdue: 'text-red-600 font-medium',
  met: 'text-green-600',
  missed: 'text-red-600 font-medium',
  paused: 'text-amber-600',
};

export function SlaBadge({ sla }: { sla: PortalTicketSla }) {
  const leg = sla.resolution;
  if (leg.status === 'none') return null;
  return (
    <span
      className={`hidden w-24 text-right text-xs tabular-nums sm:inline ${SLA_STYLES[leg.status] ?? 'text-slate-500'}`}
      title="SLA-Lösungszeit"
    >
      {leg.label}
    </span>
  );
}

export function TicketsListPage() {
  const [tickets, setTickets] = useState<PortalTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(ALL);

  useEffect(() => {
    portalApi
      .tickets()
      .then(setTickets)
      .catch(() => setError('Tickets konnten nicht geladen werden.'));
  }, []);

  // Filter chips built from the statuses actually present (workspace statuses
  // are configurable, so we don't hard-code Offen/In Arbeit/…).
  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tickets ?? []) counts.set(t.statusLabel, (counts.get(t.statusLabel) ?? 0) + 1);
    return [...counts.entries()];
  }, [tickets]);

  const waitingCount = (tickets ?? []).filter((t) => t.waitingForYou).length;
  const visible = (tickets ?? []).filter((t) =>
    status === ALL ? true : status === WAITING ? t.waitingForYou : t.statusLabel === status,
  );

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

      {tickets && tickets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Chip label="Alle" count={tickets.length} active={status === ALL} onClick={() => setStatus(ALL)} />
          {statuses.map(([label, count]) => (
            <Chip key={label} label={label} count={count} active={status === label} onClick={() => setStatus(label)} />
          ))}
          {waitingCount > 0 ? (
            <Chip label="Wartet auf mich" count={waitingCount} active={status === WAITING} onClick={() => setStatus(WAITING)} />
          ) : null}
        </div>
      ) : null}

      {tickets && visible.length === 0 ? (
        <p className="text-sm text-slate-500">{tickets.length === 0 ? 'Noch keine Tickets.' : 'Keine Tickets in dieser Ansicht.'}</p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {visible.map((t) => (
            <li key={t.id}>
              <Link to={`/tickets/${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">{t.identifier}</span>
                    <span className="truncate font-medium">{t.title}</span>
                  </div>
                  {t.projectName ? <div className="text-xs text-slate-500">{t.projectName}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <PriorityBadge ticket={t} />
                  <SlaBadge sla={t.sla} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{t.statusLabel}</span>
                  <span className="hidden w-20 text-right text-xs text-slate-400 sm:inline" title="Zuletzt aktualisiert">
                    {new Date(t.updatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label} <span className={active ? 'text-slate-300' : 'text-slate-400'}>{count}</span>
    </button>
  );
}
