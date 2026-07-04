import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';

import { portalApi, type PortalTicketDetail } from '@/lib/portal';
import { PriorityBadge } from '@/components/PriorityBadge';

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const [ticket, setTicket] = useState<PortalTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    portalApi
      .ticket(id)
      .then(setTicket)
      .catch(() => setError('Ticket nicht gefunden oder kein Zugriff.'));
  }
  useEffect(load, [id]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await portalApi.addComment(id, reply);
      setReply('');
      load();
    } finally {
      setSending(false);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!ticket) return <p className="text-sm text-slate-500">Lädt…</p>;

  return (
    <div className="space-y-5">
      <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Zurück
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-xs text-slate-400">{ticket.identifier}</div>
            <h1 className="text-lg font-semibold">{ticket.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityBadge ticket={ticket} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{ticket.statusLabel}</span>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {ticket.projectName ? <span>{ticket.projectName}</span> : null}
          {ticket.sla.status !== 'none' ? (
            <span
              className={
                ticket.sla.status === 'overdue' || ticket.sla.status === 'missed'
                  ? 'text-red-600'
                  : ticket.sla.status === 'met'
                    ? 'text-green-600'
                    : 'text-slate-500'
              }
            >
              SLA: {ticket.sla.label}
            </span>
          ) : null}
        </div>
        {ticket.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p> : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Verlauf</h2>
        {ticket.comments.length === 0 ? <p className="text-sm text-slate-500">Noch keine Kommentare.</p> : null}
        {ticket.comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium text-slate-600">{c.author}</span>
              <span>{new Date(c.createdAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
          </div>
        ))}
      </section>

      <form onSubmit={sendReply} className="space-y-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          placeholder="Antwort schreiben…"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !reply.trim()}
          className="cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? 'Senden…' : 'Antwort senden'}
        </button>
      </form>
    </div>
  );
}
