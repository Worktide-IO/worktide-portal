import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, Clock, Image, MessageCircle, Sparkles, X } from 'lucide-react';

import { portalApi, type PortalSocialPost } from '@/lib/portal';
import { safeUrl } from '@/lib/safeUrl';

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** A post's calendar date: its scheduled slot, else when it was published. */
function postDate(p: PortalSocialPost): Date | null {
  const iso = p.scheduledAt ?? p.publishedAt;
  return iso ? new Date(iso) : null;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

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
  const { t } = useTranslation();
  const [posts, setPosts] = useState<PortalSocialPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalApi.socialPosts().then(setPosts).catch(() => setError(t('social.load_error')));
  }, [t]);

  function replace(p: PortalSocialPost) {
    setPosts((prev) => (prev ?? []).map((x) => (x.id === p.id ? p : x)));
  }

  const pending = (posts ?? []).filter((p) => p.canDecide).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t('social.title')}</h1>
        <p className="text-sm text-slate-500">
          {t('social.subtitle')}
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {posts && posts.length > 0 ? <ContentCalendar posts={posts} /> : null}

      {posts && pending > 0 ? (
        <p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          {t('social.pending_count', { count: pending })}
        </p>
      ) : null}
      {posts && posts.length === 0 ? <p className="text-sm text-slate-500">{t('social.empty')}</p> : null}

      <div className="space-y-4">
        {(posts ?? []).map((p) => (
          <SocialCard key={p.id} post={p} onChange={replace} />
        ))}
      </div>
    </div>
  );
}

function ContentCalendar({ posts }: { posts: PortalSocialPost[] }) {
  const { t } = useTranslation();
  // Start on the month that holds the earliest post, else today.
  const initial = useMemo(() => {
    const dates = posts.map(postDate).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime());
    const d = dates[0] ?? new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [posts]);
  const [view, setView] = useState(initial);

  // Group posts by day within the viewed month.
  const byDay = useMemo(() => {
    const map = new Map<string, PortalSocialPost[]>();
    for (const p of posts) {
      const d = postDate(p);
      if (d && d.getFullYear() === view.year && d.getMonth() === view.month) {
        (map.get(dayKey(d)) ?? map.set(dayKey(d), []).get(dayKey(d))!).push(p);
      }
    }
    return map;
  }, [posts, view]);

  // Build the grid: leading blanks so the 1st lands under the right weekday (Mo=0).
  const first = new Date(view.year, view.month, 1);
  const lead = (first.getDay() + 6) % 7; // JS Sun=0 → Mon-based
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    setView((v) => {
      const m = v.month + delta;
      return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  function scrollTo(id: string) {
    document.getElementById(`post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-700">
          {t('social.content_calendar')} · {MONTHS[view.month]} {view.year}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={t('social.prev_month')}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" onClick={() => shift(1)} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label={t('social.next_month')}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1">{w}</div>
        ))}
        {cells.map((day, i) => {
          const list = day !== null ? byDay.get(`${view.year}-${view.month}-${day}`) ?? [] : [];
          return (
            <div key={i} className={`min-h-16 rounded border p-1 text-left ${day === null ? 'border-transparent' : 'border-slate-100'}`}>
              {day !== null ? <div className="text-[11px] text-slate-400">{day}</div> : null}
              <div className="mt-0.5 space-y-0.5">
                {list.map((p) => {
                  const pending = p.status === 'pending_approval' || p.status === 'draft';
                  const platform = p.targets[0]?.channel ?? 'Post';
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => scrollTo(p.id)}
                      title={p.statusLabel}
                      className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] ${
                        pending ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {pending ? <Clock className="size-2.5 shrink-0" /> : <Check className="size-2.5 shrink-0" />}
                      <span className="truncate">{platform}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><Check className="size-3 text-green-600" /> {t('social.legend_approved')}</span>
        <span className="flex items-center gap-1"><Clock className="size-3 text-amber-600" /> {t('social.legend_pending')}</span>
      </div>
    </div>
  );
}

function SocialCard({ post: p, onChange }: { post: PortalSocialPost; onChange: (p: PortalSocialPost) => void }) {
  const { t: translate } = useTranslation();
  const [changeOpen, setChangeOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const when = fmt(p.scheduledAt) ?? fmt(p.publishedAt);

  // Resolves true iff the action succeeded, so form callers only clear/close on
  // success. A failure surfaces an inline message instead of silently vanishing.
  async function run(fn: () => Promise<PortalSocialPost>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      onChange(await fn());
      return true;
    } catch {
      setError(translate('social.action_failed'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id={`post-${p.id}`} className="scroll-mt-6 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Sparkles className="size-3.5" /> {translate('social.ai_generated')}
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
          <Image className="size-3.5" /> {translate('social.media_attachment', { count: p.mediaCount })}
        </div>
      ) : null}

      {p.changeRequestNote ? (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium">{translate('social.change_request_label')}</span>
          {p.changeRequestNote}
        </p>
      ) : null}

      {p.targets.some((t) => safeUrl(t.permalink)) ? (
        <div className="mt-2 text-xs">
          {p.targets
            .filter((t) => safeUrl(t.permalink))
            .map((t) => (
              <a key={t.channel} href={safeUrl(t.permalink)!} target="_blank" rel="noreferrer" className="text-slate-600 underline">
                {translate('social.view_post', { channel: t.channel })}
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
              className="inline-flex items-center gap-1.5 rounded bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Check className="size-4" /> {translate('social.approve')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setChangeOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="size-4" /> {translate('social.request_change')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => portalApi.rejectSocial(p.id))}
              className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <X className="size-4" /> {translate('social.reject')}
            </button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {changeOpen ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!message.trim()) return;
                run(() => portalApi.requestSocialChange(p.id, message.trim())).then((ok) => {
                  if (!ok) return;
                  setMessage('');
                  setChangeOpen(false);
                });
              }}
              className="flex gap-2"
            >
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={translate('social.change_placeholder')}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" disabled={busy || !message.trim()} className="rounded bg-[var(--brand-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {translate('social.send')}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
