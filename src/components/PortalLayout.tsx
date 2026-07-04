import { type ReactNode, useEffect, useState } from 'react';
import {
  Boxes,
  ClipboardList,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Presentation,
  Share2,
  Ticket,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';

import { logout } from '@/providers/authProvider';
import { portalApi, type PortalMe } from '@/lib/portal';

/**
 * Portal chrome: a slim header + the full wireframe navigation, with only the
 * features enabled for this workspace clickable and the rest shown as
 * "demnächst" (see docs/RECONCILIATION.md — full nav, locked items driven by
 * the `features` map from /portal/me, so enabling a later phase needs no FE
 * rework). A customer never sees any staff/workspace internals.
 */

type NavItem = { key: string; label: string; icon: typeof Ticket; to?: string };

// key → feature flag from /portal/me. `to` set only for shipped screens.
const NAV: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { key: 'tickets', label: 'Tickets', icon: Ticket, to: '/tickets' },
  { key: 'monitoring', label: 'Monitoring', icon: Gauge, to: '/monitoring' },
  { key: 'agreements', label: 'Angebote & Verträge', icon: FileText, to: '/agreements' },
  { key: 'ideas', label: 'Ziele & Ideen', icon: Lightbulb, to: '/ideas' },
  { key: 'proposals', label: 'Vorschläge', icon: Presentation, to: '/proposals' },
  { key: 'social', label: 'Social-Freigabe', icon: Share2, to: '/social' },
  { key: 'documents', label: 'Wissen / Dateien', icon: FolderKanban, to: '/documents' },
  { key: 'forms', label: 'Fragebögen', icon: ClipboardList, to: '/forms' },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [me, setMe] = useState<PortalMe | null>(null);

  useEffect(() => {
    portalApi.me().then(setMe).catch(() => {
      // Token invalid/expired or portal disabled → back to login.
      logout();
      navigate('/login');
    });
  }, [navigate]);

  const features = me?.features ?? {};

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/tickets" className="flex items-center gap-2 font-semibold">
            <Boxes className="size-5 text-slate-900" />
            Kundenportal
          </Link>
          <div className="flex items-center gap-4">
            {me ? (
              <span className="hidden text-sm text-slate-500 sm:inline">
                {me.customer.name}
                <span className="mx-2 text-slate-300">·</span>
                {me.contact.firstName} {me.contact.lastName}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              <LogOut className="size-4" /> Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <nav className="hidden w-56 shrink-0 sm:block">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const enabled = item.to !== undefined && features[item.key] === true;
              const active = item.to !== undefined && pathname.startsWith(item.to);
              const Icon = item.icon;

              const base = 'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm';
              if (enabled) {
                return (
                  <li key={item.key}>
                    <Link
                      to={item.to!}
                      className={`${base} ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.key}>
                  <span
                    className={`${base} cursor-not-allowed text-slate-400`}
                    title="Demnächst verfügbar"
                  >
                    <Icon className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      bald
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
