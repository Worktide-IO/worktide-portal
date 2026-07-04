import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';

import { portalApi } from '@/lib/portal';

export function NewTicketPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // TODO(phase-1): if the contact's customer has more than one external
  // project, let them pick one (portalApi.me() could expose the allowed set)
  // and pass projectId. With a single project the backend picks it.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await portalApi.createTicket({ title, description });
      navigate(`/tickets/${created.id}`);
    } catch {
      setError('Ticket konnte nicht angelegt werden.');
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
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="cursor-pointer rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Anlegen…' : 'Ticket anlegen'}
        </button>
      </form>
    </div>
  );
}
