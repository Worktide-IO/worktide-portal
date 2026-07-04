import { api } from '@/lib/api';

// Curated DTOs the backend's /v1/portal/* endpoints return (see
// docs/PLAN.md + docs/RECONCILIATION.md). Deliberately NARROW — no internal
// fields (assignees, tracker, priority score, …).

export type PortalTicket = {
  id: string;
  identifier: string; // human key, e.g. WORK-142
  title: string;
  statusLabel: string;
  priority: string; // low | normal | high | urgent
  priorityLabel: string; // German label (Niedrig/Mittel/Hoch/Dringend)
  projectName: string | null;
  dueOn: string | null;
  createdAt: string;
};

export type PortalComment = {
  id: string;
  author: string; // display name
  content: string;
  createdAt: string;
};

export type PortalTicketDetail = PortalTicket & {
  description: string | null;
  comments: PortalComment[];
};

/** Per-workspace feature flags that drive the portal navigation. */
export type PortalFeatures = Record<string, boolean>;

export type PortalMe = {
  contact: { id: string; firstName: string; lastName: string; email: string | null };
  customer: { id: string; name: string };
  workspaceName: string;
  features: PortalFeatures;
};

export type NewTicketInput = {
  title: string;
  description?: string;
  priority?: string;
  projectId?: string;
};

export const portalApi = {
  me: () => api.get<PortalMe>('/portal/me').then((r) => r.data),

  tickets: () =>
    api.get<{ tickets: PortalTicket[] }>('/portal/tickets').then((r) => r.data.tickets),

  // The backend returns { ticket, comments }; flatten to a single detail object
  // so pages can read description + comments off one value.
  ticket: (id: string) =>
    api
      .get<{ ticket: PortalTicket & { description: string | null }; comments: PortalComment[] }>(
        `/portal/tickets/${id}`,
      )
      .then((r): PortalTicketDetail => ({ ...r.data.ticket, comments: r.data.comments })),

  createTicket: (input: NewTicketInput) =>
    api.post<PortalTicket>('/portal/tickets', input).then((r) => r.data),

  addComment: (id: string, content: string) =>
    api.post<PortalComment>(`/portal/tickets/${id}/comments`, { content }).then((r) => r.data),
};
