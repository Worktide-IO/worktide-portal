import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AtSign,
  Bell,
  CheckCheck,
  MessageSquare,
  Rocket,
  Server,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

import { portalApi, type PortalNotification } from '@/lib/portal';
import { useNotificationStream } from '@/lib/mercure';

const TYPE_ICON: Record<string, LucideIcon> = {
  mention: AtSign,
  task_assigned: UserPlus,
  comment: MessageSquare,
  system: Server,
  ai: Sparkles,
  launch: Rocket,
};

const PAGE_SIZE = 25;

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d === 1) return 'gestern';
  if (d < 7) return `vor ${d} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

/** Portal Benachrichtigungen page — the whole inbox, paged via "Mehr laden". */
export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  // Ids already in the list, so a live frame that races a fetch (or a duplicate
  // hub delivery) can't insert a row twice or double-count the unread total.
  const seen = useRef<Set<string>>(new Set());

  function reset() {
    // `loading` starts true and is cleared in finally — no synchronous
    // setState in the mount effect.
    portalApi
      .notifications({ limit: PAGE_SIZE })
      .then((d) => {
        d.items.forEach((n) => seen.current.add(n.id));
        setItems(d.items);
        setUnread(d.unreadCount);
        setCursor(d.nextCursor);
        setHasMore(d.nextCursor !== null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(reset, []);

  // Live push: prepend each newly-published notification at the top of the list.
  const onLive = useCallback((n: PortalNotification) => {
    if (seen.current.has(n.id)) return;
    seen.current.add(n.id);
    setItems((prev) => [n, ...prev]);
    setUnread((c) => c + 1);
  }, []);
  useNotificationStream<PortalNotification>(onLive);

  function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    portalApi
      .notifications({ limit: PAGE_SIZE, cursor })
      .then((d) => {
        d.items.forEach((n) => seen.current.add(n.id));
        setItems((prev) => [...prev, ...d.items]);
        setCursor(d.nextCursor);
        setHasMore(d.nextCursor !== null);
      })
      .finally(() => setLoading(false));
  }

  function markOne(n: PortalNotification) {
    if (n.read) return;
    setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
    setUnread((c) => Math.max(0, c - 1));
    portalApi.markNotificationRead(n.id).catch(reset);
  }

  function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    portalApi.markAllNotificationsRead().catch(reset);
  }

  function go(n: PortalNotification) {
    markOne(n);
    navigate(n.link);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Benachrichtigungen</h1>
          <p className="text-sm text-slate-500">{unread > 0 ? `${unread} ungelesen` : 'Alles gelesen'}</p>
        </div>
        <button
          type="button"
          onClick={markAll}
          disabled={unread === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <CheckCheck className="size-4" />
          Alle als gelesen markieren
        </button>
      </div>

      {items.length === 0 && !loading ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-sm text-slate-500">
          <Bell className="mx-auto mb-2 size-6 opacity-40" />
          Keine Benachrichtigungen.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {items.map((n) => {
            const Icon = TYPE_ICON[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => go(n)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-slate-50/60'}`}
                >
                  <Icon className={`mt-0.5 size-4 shrink-0 ${n.type === 'system' ? 'text-red-500' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">{n.title}</span>
                      {!n.read ? <span className="size-1.5 shrink-0 rounded-full bg-red-500" /> : null}
                    </span>
                    {n.body ? <span className="mt-0.5 block text-xs text-slate-500">{n.body}</span> : null}
                    <span className="mt-1 block text-xs text-slate-400">{relativeTime(n.occurredAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            {loading ? 'Lädt…' : 'Mehr laden'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
