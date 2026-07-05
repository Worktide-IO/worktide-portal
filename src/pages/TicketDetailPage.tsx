import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Download, Paperclip } from 'lucide-react';

import { portalApi, type PortalAttachment, type PortalSlaLeg, type PortalTicketDetail } from '@/lib/portal';
import { PriorityBadge } from '@/components/PriorityBadge';

// One SLA target (Reaktion/Lösung) in the ticket header; hidden when no target.
function SlaLeg({ label, leg }: { label: string; leg: PortalSlaLeg }) {
  if (leg.status === 'none') return null;
  const cls =
    leg.status === 'overdue' || leg.status === 'missed'
      ? 'text-red-600'
      : leg.status === 'met'
        ? 'text-green-600'
        : leg.status === 'paused'
          ? 'text-amber-600'
          : 'text-slate-500';
  return (
    <span className={cls}>
      {label}: {leg.label}
    </span>
  );
}

function formatBytes(n: number | null): string {
  if (n === null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function TicketDetailPage() {
  const { id = '' } = useParams();
  const [ticket, setTicket] = useState<PortalTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    portalApi
      .ticket(id)
      .then(setTicket)
      .catch(() => setError('Ticket nicht gefunden oder kein Zugriff.'));
  }
  useEffect(load, [id]);

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(list)) {
        await portalApi.uploadAttachment(id, file);
      }
      load();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUploadError(detail ?? 'Anhang konnte nicht hochgeladen werden.');
    } finally {
      setUploading(false);
    }
  }

  async function download(a: PortalAttachment) {
    const blob = await portalApi.downloadAttachment(id, a.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

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
          <SlaLeg label="Reaktion" leg={ticket.sla.response} />
          <SlaLeg label="Lösung" leg={ticket.sla.resolution} />
          {ticket.sla.paused ? <span className="text-amber-600">· wartet auf Sie</span> : null}
        </div>
        {ticket.description ? <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p> : null}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Paperclip className="size-4 text-slate-400" /> Anhänge
          </h2>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            <Paperclip className="size-3.5" /> {uploading ? 'Lädt hoch…' : 'Datei anhängen'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              uploadFiles(e.target.files);
              e.target.value = ''; // allow re-selecting the same file
            }}
          />
        </div>
        {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
        {ticket.attachments.length === 0 ? (
          <p className="text-sm text-slate-500">Keine Anhänge.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {ticket.attachments.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => download(a)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Download className="size-4 shrink-0 text-slate-400" />
                    <span className="truncate text-sm text-slate-700">{a.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{formatBytes(a.size)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
