import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { PortalLayout } from '@/components/PortalLayout';
import { isAuthenticated } from '@/providers/authProvider';
import { LoginPage } from '@/pages/LoginPage';
import { SetPasswordPage } from '@/pages/SetPasswordPage';
import { TicketsListPage } from '@/pages/TicketsListPage';
import { TicketDetailPage } from '@/pages/TicketDetailPage';
import { NewTicketPage } from '@/pages/NewTicketPage';
import { SystemsPage } from '@/pages/SystemsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AgreementsPage } from '@/pages/AgreementsPage';
import { IdeasPage } from '@/pages/IdeasPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { DocumentDetailPage } from '@/pages/DocumentDetailPage';

/** Gate authenticated routes; unauthenticated visitors go to /login. */
function RequireAuth({ children }: { children: ReactNode }) {
  return isAuthenticated() ? <PortalLayout>{children}</PortalLayout> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/tickets" element={<RequireAuth><TicketsListPage /></RequireAuth>} />
      <Route path="/tickets/new" element={<RequireAuth><NewTicketPage /></RequireAuth>} />
      <Route path="/tickets/:id" element={<RequireAuth><TicketDetailPage /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/monitoring" element={<RequireAuth><SystemsPage /></RequireAuth>} />
      <Route path="/agreements" element={<RequireAuth><AgreementsPage /></RequireAuth>} />
      <Route path="/ideas" element={<RequireAuth><IdeasPage /></RequireAuth>} />
      <Route path="/documents" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
      <Route path="/documents/:id" element={<RequireAuth><DocumentDetailPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/tickets" replace />} />
    </Routes>
  );
}
