import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Paperclip, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { portalApi } from '@/lib/portal';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const PRIORITIES: { value: string; labelKey: string }[] = [
  { value: 'low', labelKey: 'new_ticket.priority_low' },
  { value: 'normal', labelKey: 'new_ticket.priority_normal' },
  { value: 'high', labelKey: 'new_ticket.priority_high' },
  { value: 'urgent', labelKey: 'new_ticket.priority_urgent' },
];

export function NewTicketPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the customer's visible projects to offer a target picker. With one
  // project the backend auto-assigns it; with several it requires projectId.
  useEffect(() => {
    portalApi
      .me()
      .then((me) => {
        setProjects(me.projects);
        if (me.projects.length > 0) setProjectId(me.projects[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  function addFiles(list: FileList | null) {
    if (list) setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function suggest() {
    if (!description.trim()) return;
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const s = await portalApi.suggestTicket(description.trim());
      setTitle(s.title);
      setPriority(s.priority);
      setSuggestNote(
        s.projectName
          ? t('new_ticket.suggest_applied_project', { project: s.projectName })
          : t('new_ticket.suggest_applied'),
      );
    } catch {
      setSuggestNote(t('new_ticket.suggest_unavailable'));
    } finally {
      setSuggesting(false);
    }
  }

  // The picker below sends projectId when the customer has several projects;
  // with a single project we omit it and the backend auto-assigns that one.
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await portalApi.createTicket({
        title,
        description,
        priority,
        ...(projects.length > 1 && projectId ? { projectId } : {}),
      });
      // Attach files to the freshly-created ticket (best-effort, sequential).
      for (const file of files) {
        await portalApi.uploadAttachment(created.id, file);
      }
      navigate(`/tickets/${created.id}`);
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? t('new_ticket.create_error'));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/tickets" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="size-4" /> {t('action.back')}
      </Link>
      <h1 className="text-xl font-semibold">{t('new_ticket.title')}</h1>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <label className="block text-sm">
          {t('new_ticket.subject')}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <div className="text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>{t('new_ticket.description')}</span>
            <button
              type="button"
              onClick={suggest}
              disabled={suggesting || !description.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
              title={t('new_ticket.suggest_title')}
            >
              <Sparkles className="size-3.5" /> {suggesting ? t('new_ticket.analyzing') : t('new_ticket.suggest_button')}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
          {suggestNote ? <p className="mt-1 text-xs text-violet-700">{suggestNote}</p> : null}
        </div>
        {projects.length > 1 ? (
          <label className="block text-sm">
            {t('new_ticket.project')}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block text-sm">
          {t('new_ticket.priority')}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {t(p.labelKey)}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <span className="block">{t('new_ticket.attachments')}</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-slate-600 hover:border-slate-400"
          >
            <Paperclip className="size-4" /> {t('new_ticket.choose_files')}
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
                    aria-label={t('new_ticket.remove')}
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
          className="cursor-pointer rounded bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? t('new_ticket.creating') : t('new_ticket.create')}
        </button>
      </form>
    </div>
  );
}
