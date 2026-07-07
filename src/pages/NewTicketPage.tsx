import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

import { portalApi } from '@/lib/portal';

const PRIORITIES: { value: string; label: string }[] = [
  { value: 'low', label: 'Niedrig' },
  { value: 'normal', label: 'Mittel' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' },
];

export function NewTicketPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // With a single external project the backend picks it automatically; if the
  // customer has several it returns 400 asking for projectId — surfaced below.
  // (Project picker is a later enhancement once /portal/me exposes the set.)
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await portalApi.createTicket({ title, description, priority });
      navigate(`/tickets/${created.id}`);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Ticket konnte nicht angelegt werden.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Zurück
      </Link>
      <h1 className="text-xl font-semibold">Neues Ticket</h1>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <label className="block text-sm">
          Betreff
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Beschreibung
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Priorität
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="cursor-pointer rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Anlegen…' : 'Ticket anlegen'}
        </button>
      </form>
    </div>
  );
}
