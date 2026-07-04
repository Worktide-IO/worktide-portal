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

// Ziele & Ideen (screen 5). Goals are read-only; ideas support submit + vote.
export type PortalGoal = {
  id: string;
  title: string;
  description: string | null;
  unit: string | null;
  targetValue: number | null;
  currentValue: number | null;
  status: string; // on_track | at_risk | reached | missed
  statusLabel: string;
  progressPct: number | null;
  targetDate: string | null;
};

export type PortalIdea = {
  id: string;
  title: string;
  description: string | null;
  status: string; // proposed | under_review | accepted | rejected | done
  statusLabel: string;
  origin: string; // customer | agency | ai
  originLabel: string;
  submittedBy: string | null;
  voteCount: number;
  hasVoted: boolean;
  createdAt: string;
};

// Wissen / Dateien — published knowledge documents (read-only).
export type PortalDocument = {
  id: string;
  name: string;
  emoji: string | null;
  spaceName: string | null;
  projectName: string | null;
  updatedAt: string;
  publishedAt: string | null;
};

export type PortalDocumentDetail = PortalDocument & {
  body: string | null;
  bodyFormat: string; // markdown
};

// SEO-Fragebogen / questionnaires (screen 8). One-shot fill+submit over the
// PublicForm model; draft-save/multi-session is a modelling follow-up.
export type PortalFormField = {
  key: string;
  label: string;
  type: string; // text | textarea | email | url | number | date | select | radio | checkbox
  required: boolean;
  options: string[];
  placeholder: string | null;
  section: string | null;
};

export type PortalFormSummary = {
  id: string;
  title: string;
  description: string | null;
  fieldCount: number;
};

export type PortalFormDetail = {
  id: string;
  title: string;
  description: string | null;
  successMessage: string | null;
  fields: PortalFormField[];
};

// Ideen-Pitch (screen 7): project proposals the customer reviews.
export type PortalProposalVariant = {
  label: string;
  effortHours?: number;
  costCents?: number;
};

export type PortalProposal = {
  id: string;
  projectName: string;
  title: string;
  rationale: string | null;
  expectedBenefit: string | null;
  effortHours: number | null;
  costCents: number | null;
  currency: string;
  timeframeText: string | null;
  status: string; // new | in_review | accepted | rejected
  statusLabel: string;
  origin: string; // ai | agency
  originLabel: string;
  variants: PortalProposalVariant[];
  customerFeedback: string | null;
  ticketIdentifier: string | null;
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

  goals: () => api.get<{ goals: PortalGoal[] }>('/portal/goals').then((r) => r.data.goals),

  ideas: () => api.get<{ ideas: PortalIdea[] }>('/portal/ideas').then((r) => r.data.ideas),

  submitIdea: (title: string, description?: string) =>
    api.post<PortalIdea>('/portal/ideas', { title, description }).then((r) => r.data),

  voteIdea: (id: string) =>
    api.post<{ voteCount: number; hasVoted: boolean }>(`/portal/ideas/${id}/vote`).then((r) => r.data),

  unvoteIdea: (id: string) =>
    api.delete<{ voteCount: number; hasVoted: boolean }>(`/portal/ideas/${id}/vote`).then((r) => r.data),

  documents: () =>
    api.get<{ documents: PortalDocument[] }>('/portal/documents').then((r) => r.data.documents),

  document: (id: string) =>
    api.get<PortalDocumentDetail>(`/portal/documents/${id}`).then((r) => r.data),

  forms: () => api.get<{ forms: PortalFormSummary[] }>('/portal/forms').then((r) => r.data.forms),

  form: (id: string) => api.get<PortalFormDetail>(`/portal/forms/${id}`).then((r) => r.data),

  submitForm: (id: string, values: Record<string, unknown>) =>
    api.post<{ success: boolean; message: string | null }>(`/portal/forms/${id}/submit`, values).then((r) => r.data),

  proposals: () => api.get<{ proposals: PortalProposal[] }>('/portal/proposals').then((r) => r.data.proposals),

  acceptProposal: (id: string, variantIndex?: number) =>
    api
      .post<PortalProposal>(`/portal/proposals/${id}/accept`, variantIndex === undefined ? {} : { variantIndex })
      .then((r) => r.data),

  rejectProposal: (id: string) =>
    api.post<PortalProposal>(`/portal/proposals/${id}/reject`).then((r) => r.data),

  sendProposalFeedback: (id: string, message: string) =>
    api.post<PortalProposal>(`/portal/proposals/${id}/feedback`, { message }).then((r) => r.data),
};
