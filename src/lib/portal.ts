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

// Dashboard (post-login landing). Only truthfully-backed aggregates —
// budget/blockers/activity are deferred (see docs/RECONCILIATION.md).
export type PortalDashboard = {
  openTickets: { total: number; highPriority: number };
  systems: { active: number; total: number } | null; // null when monitoring off
  projects: { id: string; name: string; progressPct: number; openTasks: number }[];
};

// Monitoring screen: the customer's systems inventory + managed status.
// NOTE: no uptime/latency/incidents — that data isn't in the backend model
// yet (see docs/RECONCILIATION.md). We show what's real.
export type PortalSystem = {
  id: string;
  name: string;
  type: string; // typo3 | wordpress | shopware | …
  systemVersion: string | null;
  environment: string;
  environmentLabel: string;
  url: string | null;
  hostingProvider: string | null;
  isActive: boolean;
  statusLabel: string;
};

// Angebote & Verträge. Read-only: offers/contracts (line-items live in the
// PDF, signing/invoices are deferred — see docs/RECONCILIATION.md) + recurring
// subscriptions.
export type PortalAgreement = {
  id: string;
  type: string;
  typeSlug: string;
  status: string; // draft | in_negotiation | signed | expired | superseded | terminated
  statusLabel: string;
  isSigned: boolean;
  reference: string | null;
  signedOn: string | null;
  validUntil: string | null;
  hasDocument: boolean;
};

export type PortalSubscription = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingCycle: string;
  billingLabel: string;
  status: string; // trial | active | paused | cancelled
  statusLabel: string;
  nextBillingOn: string | null;
  systemName: string | null;
};

export type PortalAgreements = {
  agreements: PortalAgreement[];
  subscriptions: PortalSubscription[];
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

  systems: () =>
    api.get<{ systems: PortalSystem[] }>('/portal/systems').then((r) => r.data.systems),

  dashboard: () => api.get<PortalDashboard>('/portal/dashboard').then((r) => r.data),

  agreements: () => api.get<PortalAgreements>('/portal/agreements').then((r) => r.data),
};
