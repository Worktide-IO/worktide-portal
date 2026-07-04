import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { logout } from '@/providers/authProvider';

/**
 * The whole portal chrome: a slim header, no staff sidebar. Deliberately
 * minimal — a customer sees only their tickets, nothing of the workspace.
 */
export function PortalLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/tickets" className="text-lg font-semibold">
            Kundenportal
          </Link>
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
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
