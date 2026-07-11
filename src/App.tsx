import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { PortalLayout } from '@/components/PortalLayout';
import { ensureAuthenticated } from '@/providers/authProvider';
import { getAccessToken } from '@/lib/api';
import { LoginPage } from '@/pages/LoginPage';
import { SetPasswordPage } from '@/pages/SetPasswordPage';
import { BookingPage } from '@/pages/BookingPage';
import { BookingCancelPage } from '@/pages/BookingCancelPage';
import { BookingReschedulePage } from '@/pages/BookingReschedulePage';
import { NewsletterUnsubscribePage } from '@/pages/NewsletterUnsubscribePage';

// Authenticated feature pages are split into their own chunks so the initial
// (login) load doesn't ship the whole app — notably the ~100 KB markdown stack
// that only Documents/Proposals need. The pages use named exports, so each
// import is mapped to a `default` for React.lazy. The auth entry points
// (LoginPage/SetPasswordPage) + the shell stay eager to avoid a fallback flash
// on the very first paint.
const TicketsListPage = lazy(() => import('@/pages/TicketsListPage').then((m) => ({ default: m.TicketsListPage })));
const TicketDetailPage = lazy(() => import('@/pages/TicketDetailPage').then((m) => ({ default: m.TicketDetailPage })));
const NewTicketPage = lazy(() => import('@/pages/NewTicketPage').then((m) => ({ default: m.NewTicketPage })));
const SystemsPage = lazy(() => import('@/pages/SystemsPage').then((m) => ({ default: m.SystemsPage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AgreementsPage = lazy(() => import('@/pages/AgreementsPage').then((m) => ({ default: m.AgreementsPage })));
const IdeasPage = lazy(() => import('@/pages/IdeasPage').then((m) => ({ default: m.IdeasPage })));
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const DocumentDetailPage = lazy(() => import('@/pages/DocumentDetailPage').then((m) => ({ default: m.DocumentDetailPage })));
const FormsPage = lazy(() => import('@/pages/FormsPage').then((m) => ({ default: m.FormsPage })));
const FormFillPage = lazy(() => import('@/pages/FormFillPage').then((m) => ({ default: m.FormFillPage })));
const ProposalsPage = lazy(() => import('@/pages/ProposalsPage').then((m) => ({ default: m.ProposalsPage })));
const SocialPage = lazy(() => import('@/pages/SocialPage').then((m) => ({ default: m.SocialPage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const NewslettersPage = lazy(() => import('@/pages/NewslettersPage').then((m) => ({ default: m.NewslettersPage })));
const BookingBookPage = lazy(() => import('@/pages/BookingBookPage').then((m) => ({ default: m.BookingBookPage })));

/** Gate authenticated routes; unauthenticated visitors go to /login. */
/**
 * Gate authenticated routes. The access token lives in memory, so on a fresh
 * load/reload it's absent → we silently refresh from the httpOnly cookie
 * (ensureAuthenticated) and show a loading state until it resolves. Once a token
 * is in memory, navigation is synchronous.
 */
function RequireAuth({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'pending' | 'authed' | 'anon'>(() =>
    getAccessToken() !== null ? 'authed' : 'pending',
  );

  useEffect(() => {
    if (status !== 'pending') return;
    let alive = true;
    ensureAuthenticated().then((ok) => {
      if (alive) setStatus(ok ? 'authed' : 'anon');
    });
    return () => {
      alive = false;
    };
  }, [status]);

  if (status === 'pending') return <p className="p-6 text-sm text-slate-500">Lädt…</p>;
  if (status === 'anon') return <Navigate to="/login" replace />;
  return <PortalLayout>{children}</PortalLayout>;
}

export default function App() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">Lädt…</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/set-password" element={<SetPasswordPage />} />
        {/* Public, unauthenticated booking pages — no RequireAuth. */}
        <Route path="/book/cancel/:token" element={<BookingCancelPage />} />
        <Route path="/book/reschedule/:token" element={<BookingReschedulePage />} />
        <Route path="/book/:slug" element={<BookingPage />} />
        <Route path="/newsletter/unsubscribe/:token" element={<NewsletterUnsubscribePage />} />
        <Route path="/tickets" element={<RequireAuth><TicketsListPage /></RequireAuth>} />
        <Route path="/tickets/new" element={<RequireAuth><NewTicketPage /></RequireAuth>} />
        <Route path="/tickets/:id" element={<RequireAuth><TicketDetailPage /></RequireAuth>} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/monitoring" element={<RequireAuth><SystemsPage /></RequireAuth>} />
        <Route path="/agreements" element={<RequireAuth><AgreementsPage /></RequireAuth>} />
        <Route path="/ideas" element={<RequireAuth><IdeasPage /></RequireAuth>} />
        <Route path="/documents" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
        <Route path="/documents/:id" element={<RequireAuth><DocumentDetailPage /></RequireAuth>} />
        <Route path="/forms" element={<RequireAuth><FormsPage /></RequireAuth>} />
        <Route path="/forms/:id" element={<RequireAuth><FormFillPage /></RequireAuth>} />
        <Route path="/proposals" element={<RequireAuth><ProposalsPage /></RequireAuth>} />
        <Route path="/social" element={<RequireAuth><SocialPage /></RequireAuth>} />
        <Route path="/benachrichtigungen" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="/einstellungen" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        <Route path="/newsletter" element={<RequireAuth><NewslettersPage /></RequireAuth>} />
        <Route path="/termin" element={<RequireAuth><BookingBookPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/tickets" replace />} />
      </Routes>
    </Suspense>
  );
}
