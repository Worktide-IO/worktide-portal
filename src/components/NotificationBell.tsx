import { useCallback, useEffect, useRef, useState } from 'react';
import { intlLocale } from '@/lib/intl';
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

import { useTranslation } from 'react-i18next';

import { portalApi, type PortalNotification } from '@/lib/portal';
import { useNotificationStream } from '@/lib/mercure';
import i18n from '@/i18n';

const TYPE_ICON: Record<string, LucideIcon> = {
  mention: AtSign,
  task_assigned: UserPlus,
  comment: MessageSquare,
  system: Server,
  ai: Sparkles,
  launch: Rocket,
};

const DROPDOWN_LIMIT = 8;

function relativeTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return i18n.t('notif_bell.time_now');
  if (min < 60) return i18n.t('notif_bell.time_minutes', { count: min });
  const h = Math.round(min / 60);
  if (h < 24) return i18n.t('notif_bell.time_hours', { count: h });
  const d = Math.round(h / 24);
  if (d === 1) return i18n.t('notif_bell.time_yesterday');
  if (d < 7) return i18n.t('notif_bell.time_days', { count: d });
  return new Date(iso).toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short' });
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  // Ids we've already shown, so a live frame that races the initial load (or a
  // duplicate hub delivery) can't double-count the unread badge.
  const seen = useRef<Set<string>>(new Set());

  function load() {
    portalApi
      .notifications({ limit: DROPDOWN_LIMIT })
      .then((d) => {
        d.items.forEach((n) => seen.current.add(n.id));
        setItems(d.items);
        setUnread(d.unreadCount);
      })
      .catch(() => {
        /* non-critical — leave the bell empty */
      });
  }

  useEffect(load, []);

  // Live push: prepend each newly-published notification and bump the badge.
  const onLive = useCallback((n: PortalNotification) => {
    if (seen.current.has(n.id)) return;
    seen.current.add(n.id);
    setItems((prev) => [n, ...prev].slice(0, DROPDOWN_LIMIT));
    setUnread((c) => c + 1);
  }, []);
  useNotificationStream<PortalNotification>(onLive);

  function markOne(n: PortalNotification) {
    if (n.read) return;
    setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, read: true } : it)));
    setUnread((c) => Math.max(0, c - 1));
    portalApi.markNotificationRead(n.id).catch(load);
  }

  function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    portalApi.markAllNotificationsRead().catch(load);
  }

  function go(n: PortalNotification) {
    markOne(n);
    setOpen(false);
    navigate(n.link);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('notif_bell.title')}
        className="relative inline-flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell className="size-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-700">{t('notif_bell.title')}</span>
              <button
                type="button"
                onClick={markAll}
                disabled={unread === 0}
                className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
              >
                <CheckCheck className="size-3.5" />
                {t('notif_bell.mark_all_read')}
              </button>
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">{t('notif_bell.empty')}</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
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
                          {n.body ? <span className="mt-0.5 block truncate text-xs text-slate-500">{n.body}</span> : null}
                          <span className="mt-0.5 block text-xs text-slate-400">{relativeTime(n.occurredAt)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="border-t border-slate-100 px-2 py-1.5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/benachrichtigungen');
                }}
                className="w-full rounded px-2 py-1.5 text-center text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                {t('notif_bell.view_all')}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
