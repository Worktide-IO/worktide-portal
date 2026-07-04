import { api } from '@/lib/api';

// Curated DTOs the backend's /v1/portal/* endpoints return (see docs/PLAN.md).
// Deliberately NARROW — no internal fields (priorityScore, assignees, …).

export type PortalTicket = {
  id: string;
  title: string;
  statusLabel: string;
  projectName: string;
  dueOn: string | null;
  createdAt: string;
};

export type PortalComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type PortalTicketDetail = PortalTicket & {
  description: string | null;
  comments: PortalComment[];
};

export type PortalMe = {
  contact: { firstName: string; lastName: string; email: string };
  customer: { name: string };
  workspaceName: string;
};

export const portalApi = {
  me: () => api.get<PortalMe>('/portal/me').then((r) => r.data),
  tickets: () => api.get<{ member: PortalTicket[] }>('/portal/tickets').then((r) => r.data.member),
  ticket: (id: string) => api.get<PortalTicketDetail>(`/portal/tickets/${id}`).then((r) => r.data),
  createTicket: (input: { title: string; description: string; projectId?: string }) =>
    api.post<PortalTicketDetail>('/portal/tickets', input).then((r) => r.data),
  addComment: (id: string, body: string) =>
    api.post<PortalComment>(`/portal/tickets/${id}/comments`, { body }).then((r) => r.data),
};
