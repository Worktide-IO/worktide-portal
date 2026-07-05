import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  Bell,
  FileText,
  MessageSquare,
  Share2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { portalApi, type PortalNotification } from '@/lib/portal';

const TYPE_ICON: Record<string, LucideIcon> = {
  ticket_reply: MessageSquare,
  proposal: Sparkles,
  social: Share2,
  agreement: FileText,
  incident: AlertTriangle,
};

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

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  function load() {
    portalApi
      .notifications()
      .then((d) => {
        setItems(d.items);
        setUnread(d.unreadCount);
      })
      .catch(() => {
        /* non-critical — leave the bell empty */
      });
  }

  useEffect(load, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Opening the bell clears the badge (marks everything seen).
      portalApi.markNotificationsRead().catch(() => {});
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  function go(link: string) {
    setOpen(false);
    navigate(link);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Benachrichtigungen"
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
            <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Benachrichtigungen
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Keine Benachrichtigungen.</p>
            ) : (
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {items.map((n) => {
                  const Icon = TYPE_ICON[n.type] ?? Bell;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => go(n.link)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-slate-50/60'}`}
                      >
                        <Icon className={`mt-0.5 size-4 shrink-0 ${n.type === 'incident' ? 'text-red-500' : 'text-slate-400'}`} />
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
          </div>
        </>
      ) : null}
    </div>
  );
}
