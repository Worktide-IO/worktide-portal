import { useEffect, useState } from 'react';
import { Check, Image, MessageCircle, Sparkles, X } from 'lucide-react';

import { portalApi, type PortalSocialPost } from '@/lib/portal';

const STATUS_CLASSES: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800',
  draft: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-green-100 text-green-700',
  published: 'bg-slate-100 text-slate-500',
  canceled: 'bg-red-100 text-red-700',
};

function fmt(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : null;
}

export function SocialPage() {
  const [posts, setPosts] = useState<PortalSocialPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi.socialPosts().then(setPosts).catch(() => setError('Beiträge konnten nicht geladen werden.'));
  }, []);

  function replace(p: PortalSocialPost) {
    setPosts((prev) => (prev ?? []).map((x) => (x.id === p.id ? p : x)));
  }

  const pending = (posts ?? []).filter((p) => p.canDecide).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Social-Freigabe</h1>
        <p className="text-sm text-slate-500">
          KI-erstellte Beiträge prüfen und freigeben, bevor sie veröffentlicht werden.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {posts && pending > 0 ? (
        <p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          {pending} warten auf Freigabe
        </p>
      ) : null}
      {posts && posts.length === 0 ? <p className="text-sm text-slate-500">Keine Beiträge.</p> : null}

      <div className="space-y-4">
        {(posts ?? []).map((p) => (
          <SocialCard key={p.id} post={p} onChange={replace} />
        ))}
      </div>
    </div>
  );
}

function SocialCard({ post: p, onChange }: { post: PortalSocialPost; onChange: (p: PortalSocialPost) => void }) {
  const [changeOpen, setChangeOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const when = fmt(p.scheduledAt) ?? fmt(p.publishedAt);

  async function run(fn: () => Promise<PortalSocialPost>) {
    setBusy(true);
    try {
      onChange(await fn());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Sparkles className="size-3.5" /> KI-generiert
          {p.targets.map((t) => (
            <span key={t.channel} className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              {t.channel}
            </span>
          ))}
          {when ? <span>· {when}</span> : null}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {p.statusLabel}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{p.body}</p>

      {p.mediaCount > 0 ? (
        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
          <Image className="size-3.5" /> {p.mediaCount} Medien-Anhang{p.mediaCount > 1 ? 'e' : ''}
        </div>
      ) : null}

      {p.changeRequestNote ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium">Änderungswunsch: </span>
          {p.changeRequestNote}
        </p>
      ) : null}

      {p.targets.some((t) => t.permalink) ? (
        <div className="mt-2 text-xs">
          {p.targets
            .filter((t) => t.permalink)
            .map((t) => (
              <a key={t.channel} href={t.permalink!} target="_blank" rel="noreferrer" className="text-slate-600 underline">
                Beitrag ansehen ({t.channel})
              </a>
            ))}
        </div>
      ) : null}

      {p.canDecide ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => portalApi.approveSocial(p.id))}
              className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Check className="size-4" /> Freigeben
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setChangeOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="size-4" /> Änderung anfordern
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => portalApi.rejectSocial(p.id))}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <X className="size-4" /> Ablehnen
            </button>
          </div>

          {changeOpen ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!message.trim()) return;
                run(() => portalApi.requestSocialChange(p.id, message.trim())).then(() => {
                  setMessage('');
                  setChangeOpen(false);
                });
              }}
              className="flex gap-2"
            >
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Was sollen wir ändern?"
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={busy || !message.trim()} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                Senden
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
