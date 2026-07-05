import { api } from '@/lib/api';

// Curated DTOs the backend's /v1/portal/* endpoints return (see
// docs/PLAN.md + docs/RECONCILIATION.md). Deliberately NARROW — no internal
// fields (assignees, tracker, priority score, …).

export type PortalTicketSla = {
  status: string; // due | overdue | met | missed | none
  label: string; // "in 4 Std." | "überschritten" | "erfüllt" | "—"
  dueAt: string | null;
};

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
  updatedAt: string;
  sla: PortalTicketSla;
};

export type PortalComment = {
  id: string;
  author: string; // display name
  content: string;
  createdAt: string;
};

export type PortalAttachment = {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  uploadedAt: string | null;
};

export type PortalTicketDetail = PortalTicket & {
  description: string | null;
  comments: PortalComment[];
  attachments: PortalAttachment[];
};

/** Per-workspace feature flags that drive the portal navigation. */
export type PortalFeatures = Record<string, boolean>;

// Notifications (header bell). Derived server-side from real signals; read
// state is a single "seen at" marker cleared by markNotificationsRead().
export type PortalNotification = {
  id: string;
  type: string; // ticket_reply | proposal | social | agreement | incident
  title: string;
  body: string | null;
  link: string;
  occurredAt: string;
  read: boolean;
};

export type PortalMe = {
  contact: { id: string; firstName: string; lastName: string; email: string | null };
  customer: { id: string; name: string };
  workspaceName: string;
  features: PortalFeatures;
};

// Dashboard (post-login landing). Every section is backed by a real, customer-
// scoped source (see PortalDashboardController + docs/RECONCILIATION.md).
export type PortalDashboardActivity = {
  id: string;
  label: string; // "Ticket erstellt" | "Ticket aktualisiert"
  actor: string; // "Sie" | "Agentur"
  ticketIdentifier: string | null;
  ticketTitle: string | null;
  occurredAt: string;
};

export type PortalDashboard = {
  customerName: string;
  openTickets: { total: number; highPriority: number };
  // Retainer-budget tile: consumed vs. monthly allowance. Null when the customer
  // has no retainer project with a budget (tile hidden).
  budget: { consumedMinutes: number; budgetMinutes: number; pct: number } | null;
  systems: { active: number; total: number; openIncidents: number } | null; // null when monitoring off
  projects: { id: string; name: string; progressPct: number; openTasks: number }[];
  blockers: { id: string; identifier: string; title: string; projectName: string | null }[];
  activity: PortalDashboardActivity[];
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
  status: string; // operational | degraded | down | maintenance | inactive
  statusLabel: string;
  uptimePct: number | null;
  avgResponseMs: number | null;
  uptimeDays: { day: string; uptimePct: number }[];
};

export type PortalSystemIncident = {
  id: string;
  systemName: string;
  kind: string; // outage | degraded | maintenance
  kindLabel: string;
  title: string;
  startedAt: string;
  resolvedAt: string | null;
  open: boolean;
};

// Angebote & Verträge. Read-only: offers/contracts (line-items live in the
// PDF, signing/invoices are deferred — see docs/RECONCILIATION.md) + recurring
// subscriptions.
export type PortalAgreementLineItem = {
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number; // line total = quantity × unit
  isRecurring: boolean;
};

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
  canSign: boolean;
  signedBy: string | null;
  lineItems: PortalAgreementLineItem[];
  totalCents: number;
  currency: string;
  totalIsRecurring: boolean; // true → total is a monthly sum ("Summe / Monat")
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

export type PortalProjectOffer = {
  id: string;
  reference: string;
  title: string;
  amountCents: number;
  currency: string;
  status: string;
  statusLabel: string;
  createdAt: string;
};

export type PortalAgreements = {
  agreements: PortalAgreement[];
  subscriptions: PortalSubscription[];
  projectOffers: PortalProjectOffer[];
};

// Rechnungen — read-only invoices mirrored from lexoffice (feature: invoices).
export type PortalInvoice = {
  id: string;
  number: string;
  issuedOn: string;
  dueOn: string | null;
  totalCents: number;
  openCents: number | null;
  currency: string;
  status: string; // open | paid | voided | overdue
  statusLabel: string;
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

// Brainstorming board (screen 5): a shared free-form note stream.
export type PortalBrainstormNote = {
  id: string;
  body: string;
  authorName: string;
  origin: string; // customer | agency | ai
  originLabel: string; // Sie | Agentur | KI
  isMine: boolean;
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
  draft: Record<string, unknown> | null;
  draftSavedAt: string | null;
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
  offerReference: string | null;
};

// Social-Freigabe (screen 6): review + approve AI-drafted social posts.
export type PortalSocialTarget = { channel: string; permalink: string | null };

export type PortalSocialPost = {
  id: string;
  body: string;
  mediaCount: number;
  status: string; // draft | pending_approval | scheduled | published | ...
  statusLabel: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  changeRequestNote: string | null;
  canDecide: boolean;
  targets: PortalSocialTarget[];
};

export type NewTicketInput = {
  title: string;
  description?: string;
  priority?: string;
  projectId?: string;
};

// AI-structured suggestion from a free-text description (screen 2, "KI").
export type PortalTicketSuggestion = {
  title: string;
  priority: string;
  priorityLabel: string;
  projectId: string | null;
  projectName: string | null;
};

export const portalApi = {
  me: () => api.get<PortalMe>('/portal/me').then((r) => r.data),

  notifications: () =>
    api
      .get<{ items: PortalNotification[]; unreadCount: number }>('/portal/notifications')
      .then((r) => r.data),

  markNotificationsRead: () =>
    api.post<{ unreadCount: number }>('/portal/notifications/mark-read').then((r) => r.data),

  tickets: () =>
    api.get<{ tickets: PortalTicket[] }>('/portal/tickets').then((r) => r.data.tickets),

  // The backend returns { ticket, comments }; flatten to a single detail object
  // so pages can read description + comments off one value.
  ticket: (id: string) =>
    api
      .get<{
        ticket: PortalTicket & { description: string | null };
        comments: PortalComment[];
        attachments: PortalAttachment[];
      }>(`/portal/tickets/${id}`)
      .then(
        (r): PortalTicketDetail => ({
          ...r.data.ticket,
          comments: r.data.comments,
          attachments: r.data.attachments,
        }),
      ),

  createTicket: (input: NewTicketInput) =>
    api.post<PortalTicket>('/portal/tickets', input).then((r) => r.data),

  suggestTicket: (description: string) =>
    api
      .post<PortalTicketSuggestion>('/portal/tickets/suggest', { description })
      .then((r) => r.data),

  addComment: (id: string, content: string) =>
    api.post<PortalComment>(`/portal/tickets/${id}/comments`, { content }).then((r) => r.data),

  uploadAttachment: (ticketId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<PortalAttachment>(`/portal/tickets/${ticketId}/attachments`, form)
      .then((r) => r.data);
  },

  // Downloads through axios so the Bearer token is sent, then hands back a Blob
  // the caller can turn into an object URL.
  downloadAttachment: (ticketId: string, fileId: string) =>
    api
      .get<Blob>(`/portal/tickets/${ticketId}/attachments/${fileId}/content`, { responseType: 'blob' })
      .then((r) => r.data),

  systems: (days?: number) =>
    api
      .get<{
        systems: PortalSystem[];
        incidents: PortalSystemIncident[];
        windowDays: number;
        availableWindows: number[];
      }>('/portal/systems', days ? { params: { days } } : undefined)
      .then((r) => r.data),

  dashboard: () => api.get<PortalDashboard>('/portal/dashboard').then((r) => r.data),

  agreements: () => api.get<PortalAgreements>('/portal/agreements').then((r) => r.data),

  invoices: () =>
    api.get<{ invoices: PortalInvoice[] }>('/portal/invoices').then((r) => r.data.invoices),

  signAgreement: (id: string, fullName: string) =>
    api.post<PortalAgreement>(`/portal/agreements/${id}/sign`, { fullName }).then((r) => r.data),

  goals: () => api.get<{ goals: PortalGoal[] }>('/portal/goals').then((r) => r.data.goals),

  ideas: () => api.get<{ ideas: PortalIdea[] }>('/portal/ideas').then((r) => r.data.ideas),

  submitIdea: (title: string, description?: string) =>
    api.post<PortalIdea>('/portal/ideas', { title, description }).then((r) => r.data),

  voteIdea: (id: string) =>
    api.post<{ voteCount: number; hasVoted: boolean }>(`/portal/ideas/${id}/vote`).then((r) => r.data),

  unvoteIdea: (id: string) =>
    api.delete<{ voteCount: number; hasVoted: boolean }>(`/portal/ideas/${id}/vote`).then((r) => r.data),

  brainstorm: () =>
    api.get<{ notes: PortalBrainstormNote[] }>('/portal/brainstorm').then((r) => r.data.notes),

  postBrainstorm: (body: string) =>
    api.post<PortalBrainstormNote>('/portal/brainstorm', { body }).then((r) => r.data),

  documents: () =>
    api.get<{ documents: PortalDocument[] }>('/portal/documents').then((r) => r.data.documents),

  document: (id: string) =>
    api.get<PortalDocumentDetail>(`/portal/documents/${id}`).then((r) => r.data),

  forms: () => api.get<{ forms: PortalFormSummary[] }>('/portal/forms').then((r) => r.data.forms),

  form: (id: string) => api.get<PortalFormDetail>(`/portal/forms/${id}`).then((r) => r.data),

  submitForm: (id: string, values: Record<string, unknown>) =>
    api.post<{ success: boolean; message: string | null }>(`/portal/forms/${id}/submit`, values).then((r) => r.data),

  saveFormDraft: (id: string, values: Record<string, unknown>) =>
    api.put<{ savedAt: string }>(`/portal/forms/${id}/draft`, values).then((r) => r.data),

  proposals: () => api.get<{ proposals: PortalProposal[] }>('/portal/proposals').then((r) => r.data.proposals),

  acceptProposal: (id: string, variantIndex?: number) =>
    api
      .post<PortalProposal>(`/portal/proposals/${id}/accept`, variantIndex === undefined ? {} : { variantIndex })
      .then((r) => r.data),

  rejectProposal: (id: string) =>
    api.post<PortalProposal>(`/portal/proposals/${id}/reject`).then((r) => r.data),

  sendProposalFeedback: (id: string, message: string) =>
    api.post<PortalProposal>(`/portal/proposals/${id}/feedback`, { message }).then((r) => r.data),

  socialPosts: () => api.get<{ posts: PortalSocialPost[] }>('/portal/social').then((r) => r.data.posts),

  approveSocial: (id: string) =>
    api.post<PortalSocialPost>(`/portal/social/${id}/approve`).then((r) => r.data),

  rejectSocial: (id: string) =>
    api.post<PortalSocialPost>(`/portal/social/${id}/reject`).then((r) => r.data),

  requestSocialChange: (id: string, message: string) =>
    api.post<PortalSocialPost>(`/portal/social/${id}/request-change`, { message }).then((r) => r.data),
};
