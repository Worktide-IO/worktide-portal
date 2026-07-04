import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Paperclip, X } from 'lucide-react';

import { portalApi } from '@/lib/portal';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

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
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (list) setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  // With a single external project the backend picks it automatically; if the
  // customer has several it returns 400 asking for projectId — surfaced below.
  // (Project picker is a later enhancement once /portal/me exposes the set.)
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await portalApi.createTicket({ title, description, priority });
      // Attach files to the freshly-created ticket (best-effort, sequential).
      for (const file of files) {
        await portalApi.uploadAttachment(created.id, file);
      }
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
        <div className="text-sm">
          <span className="block">Anhänge</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-slate-600 hover:border-slate-400"
          >
            <Paperclip className="size-4" /> Dateien auswählen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {files.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded bg-slate-50 px-2.5 py-1.5 text-xs">
                  <span className="min-w-0 truncate text-slate-700">
                    {f.name} <span className="text-slate-400">· {formatBytes(f.size)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 text-slate-400 hover:text-red-600"
                    aria-label="Entfernen"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
