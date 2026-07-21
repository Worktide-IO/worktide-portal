import { api } from '@/lib/api';
import type { TranslationsMap } from '@/lib/localize';

// Curated DTOs the backend's /v1/portal/* endpoints return (see
// docs/PLAN.md + docs/RECONCILIATION.md). Deliberately NARROW — no internal
// fields (assignees, tracker, priority score, …).

// One SLA target (response or resolution).
export type PortalSlaLeg = {
  status: string; // due | overdue | met | missed | paused | none
  label: string; // "in 4 Std." | "überschritten" | "erfüllt" | "pausiert" | "—"
  dueAt: string | null;
};

export type PortalTicketSla = {
  paused: boolean; // ticket is waiting on the customer → clock paused
  response: PortalSlaLeg; // time to first agency reply
  resolution: PortalSlaLeg; // time to done
};

export type PortalTicket = {
  id: string;
  identifier: string; // human key, e.g. WORK-142
  title: string;
  statusLabel: string;
  waitingForYou: boolean; // status flagged "waiting on the customer"
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

// Notifications (header bell + Benachrichtigungen page). Persisted per-item
// server-side; each has its own read state, marked individually or in bulk.
export type PortalNotification = {
  id: string;
  type: string; // mention | task_assigned | comment | system | ai | launch
  title: string;
  body: string | null;
  link: string;
  occurredAt: string;
  read: boolean;
};

export type PortalNotificationFeed = {
  items: PortalNotification[];
  unreadCount: number;
  nextCursor: string | null;
};

// Notification delivery preferences (Einstellungen page). In-app/bell is always
// on and not represented here — this governs the email channel only.
export type NotificationFrequency = 'instant' | 'daily' | 'weekly';

export type NotificationChannelPrefs = {
  email: boolean;
  chat: boolean;
  frequency: NotificationFrequency;
  types: Record<string, boolean>;
  quietHours: { start: string; end: string } | null;
};

export type ChatProvider = 'slack' | 'mattermost' | 'teams';
export type ChatWebhookStatus = { provider: ChatProvider | null; enabled: boolean; configured: boolean };

// Newsletter tree (opt-in/out per node). `subscribable` nodes carry a checkbox;
// non-subscribable nodes are structural group headers (an ancestor of a granted
// node that isn't itself granted to the customer).
export type PortalNewsletterNode = {
  id: string;
  title: string;
  description: string | null;
  translations?: TranslationsMap | null;
  icon: string;
  color: string;
  slug: string | null;
  // Estimated send cadence: raw enum value + a server-localised label (null = not stated).
  estimatedFrequency: string | null;
  estimatedFrequencyLabel: string | null;
  subscribable: boolean;
  // Mandatory/transactional node: always on, no toggle (locked checkbox in the UI).
  mandatory: boolean;
  subscribed: boolean;
  // Opted in but awaiting a double-opt-in confirmation click (email link).
  pending: boolean;
  children: PortalNewsletterNode[];
};

export type PortalMe = {
  contact: { id: string; firstName: string; lastName: string; email: string | null };
  customer: { id: string; name: string };
  projects: { id: string; name: string }[];
  workspaceName: string;
  features: PortalFeatures;
  // Preferred display language (a supported-locale code) or null = follow the
  // workspace / app default. `supportedLanguages` is the server's allow-list.
  preferredLanguage: string | null;
  supportedLanguages: string[];
};

/** Human labels for locale codes; unknown codes fall back to the raw code. */
export const LANGUAGE_LABELS: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
};

export function languageLabel(code: string): string {
  return LANGUAGE_LABELS[code] ?? code;
}

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

// Limited availability of an agency staff member the customer works with
// (ticket assignee / project owner). The medical reason is NOT exposed by the
// backend — only the percentage and the window.
export type PortalStaffAvailability = {
  staffName: string;
  availabilityPercent: number;
  startsOn: string;
  endsOn: string;
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
  translations?: TranslationsMap | null; // per-locale `description` overrides
  quantity: number;
  unitAmountCents: number;
  amountCents: number; // line total = quantity × unit
  isRecurring: boolean;
};

export type PortalAgreement = {
  id: string;
  type: string;
  // Per-locale overrides for `type` (the agreement type's name), keyed 'type'.
  translations?: TranslationsMap | null;
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
  inquiry: string | null; // customer's latest "Rückfrage" on an open offer
  inquiredAt: string | null;
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

// Formulare / questionnaires (screen 8), Tally-like engine (schema v2).
// The backend sends both a flat `fields` list (back-compat) and a nested
// `schema` document (pages → blocks + branching logic + calc). The renderer
// prefers `schema` and falls back to `fields`.
export type PortalFormField = {
  key: string;
  label: string;
  labelI18n?: Record<string, string>; // per-locale label overrides
  type: string; // text | long_text | email | url | number | date | boolean | select | multi_select | rating | scale | matrix | file
  required: boolean;
  options: string[];
  placeholder: string | null;
  section: string | null;
};

// --- v2 engine document ---------------------------------------------------

export type FormBlock = {
  id: string;
  key: string;
  type: string;
  label: string;
  labelI18n?: Record<string, string>; // per-locale label overrides
  optionsI18n?: Record<string, string[]>; // per-locale option labels (index-aligned with options)
  rowsI18n?: Record<string, string[]>; // per-locale matrix row labels (index-aligned with rows)
  required: boolean;
  options: string[];
  placeholder: string | null;
  hidden: boolean;
  min: number | null;
  max: number | null;
  rows: string[];
};

export type FormPage = {
  id: string;
  title: string | null;
  blocks: FormBlock[];
};

// Condition atom read by the branching engine. `op` ∈
// eq|neq|contains|gt|gte|lt|lte|in|empty|not_empty.
export type LogicAtom = { field: string; op: string; value?: unknown };
export type LogicCondition = { all?: LogicAtom[]; any?: LogicAtom[]; field?: string; op?: string; value?: unknown };
export type LogicRule = {
  if: LogicCondition;
  then: { action: 'show' | 'hide' | 'jump'; target: string; from?: string };
};

// Structured calc AST (no string eval): {op,args} over {field}|{const} nodes.
export type CalcNode = { op?: string; args?: CalcNode[]; field?: string; const?: number };
export type CalcRule = { key: string; ast: CalcNode };

export type FormSchema = {
  version: number;
  pages: FormPage[];
  logic: LogicRule[];
  calc: CalcRule[];
};

export type PortalFormSummary = {
  id: string;
  title: string;
  description: string | null;
  translations?: TranslationsMap | null;
  fieldCount: number;
};

export type PortalFormDetail = {
  id: string;
  title: string;
  description: string | null;
  successMessage: string | null;
  translations?: TranslationsMap | null;
  schema: FormSchema | null;
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
  mockupBeforeUrl: string | null;
  mockupAfterUrl: string | null;
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

export type PortalContactAbsence = {
  id: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string;
  note: string | null;
};

export type PortalMeetingType = {
  slug: string;
  title: string;
  description: string | null;
  translations?: TranslationsMap | null;
  durationMinutes: number;
  locationType: string; // video | phone | in_person
  hostName: string | null;
};

export type PortalFolder = { id: string; name: string };
export type PortalFileItem = {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  uploadedAt?: string | null;
};
export type PortalFilesResponse = {
  folder: PortalFolder | null;
  folders: PortalFolder[];
  files: PortalFileItem[];
};

export const portalApi = {
  me: () => api.get<PortalMe>('/portal/me').then((r) => r.data),

  meetingTypes: () =>
    api
      .get<{ meetingTypes: PortalMeetingType[] }>('/portal/meeting-types')
      .then((r) => r.data.meetingTypes),

  contactAbsences: () =>
    api.get<{ absences: PortalContactAbsence[] }>('/portal/absences').then((r) => r.data.absences),

  staffAvailability: () =>
    api
      .get<{ staff: PortalStaffAvailability[] }>('/portal/staff-availability')
      .then((r) => r.data.staff),

  createContactAbsence: (input: { startsOn: string; endsOn: string; note?: string }) =>
    api.post<PortalContactAbsence>('/portal/absences', input).then((r) => r.data),

  deleteContactAbsence: (id: string) =>
    api.delete<{ deleted: boolean }>(`/portal/absences/${id}`).then((r) => r.data),

  chatWebhook: () =>
    api.get<ChatWebhookStatus>('/portal/chat-webhook').then((r) => r.data),

  saveChatWebhook: (input: { provider: ChatProvider; url: string; enabled: boolean }) =>
    api.put<ChatWebhookStatus>('/portal/chat-webhook', input).then((r) => r.data),

  deleteChatWebhook: () =>
    api.delete<{ deleted: boolean }>('/portal/chat-webhook').then((r) => r.data),

  testChatWebhook: () =>
    api.post<{ sent: boolean }>('/portal/chat-webhook/test').then((r) => r.data),

  // Set the portal user's preferred display language (null = auto).
  setLanguage: (preferredLanguage: string | null) =>
    api
      .patch<PortalMe>('/portal/me', { preferredLanguage }, {
        headers: { 'Content-Type': 'application/merge-patch+json' },
      })
      .then((r) => r.data),

  notifications: (params: { cursor?: string | null; limit?: number; unread?: boolean } = {}) =>
    api
      .get<PortalNotificationFeed>('/portal/notifications', {
        params: {
          ...(params.cursor ? { cursor: params.cursor } : {}),
          ...(params.limit ? { limit: params.limit } : {}),
          ...(params.unread ? { unread: 1 } : {}),
        },
      })
      .then((r) => r.data),

  markNotificationRead: (id: string) =>
    api
      .post<{ unreadCount: number }>(`/portal/notifications/${id}/read`)
      .then((r) => r.data),

  markAllNotificationsRead: () =>
    api.post<{ unreadCount: number }>('/portal/notifications/read-all').then((r) => r.data),

  newsletters: () =>
    api.get<{ newsletters: PortalNewsletterNode[] }>('/portal/newsletters').then((r) => r.data.newsletters),

  subscribeNewsletter: (id: string) =>
    api.post<{ id: string; subscribed: boolean }>(`/portal/newsletters/${id}/subscription`).then((r) => r.data),

  unsubscribeNewsletter: (id: string) =>
    api.delete<{ id: string; subscribed: boolean }>(`/portal/newsletters/${id}/subscription`).then((r) => r.data),

  notificationPreferences: () =>
    api.get<NotificationChannelPrefs>('/portal/notification-preferences').then((r) => r.data),

  // Partial merge server-side (PATCH) — send only the keys that changed.
  saveNotificationPreferences: (prefs: Partial<NotificationChannelPrefs>) =>
    api
      .patch<NotificationChannelPrefs>('/portal/notification-preferences', prefs, {
        headers: { 'Content-Type': 'application/json' },
      })
      .then((r) => r.data),

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

  // Shared customer file area (folders + files scoped to the caller's customer
  // server-side). `folderId` = null/undefined → the customer's root.
  files: (folderId?: string) =>
    api
      .get<PortalFilesResponse>('/portal/files', { params: folderId ? { folder: folderId } : {} })
      .then((r) => r.data),

  uploadPortalFile: (parentId: string | null, file: File) => {
    const form = new FormData();
    form.append('file', file);
    if (parentId) {
      form.append('parent', parentId);
    }
    return api.post<PortalFileItem>('/portal/files', form).then((r) => r.data);
  },

  downloadPortalFile: (fileId: string) =>
    api.get<Blob>(`/portal/files/${fileId}/content`, { responseType: 'blob' }).then((r) => r.data),

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

  inquireAgreement: (id: string, message: string) =>
    api.post<PortalAgreement>(`/portal/agreements/${id}/inquiry`, { message }).then((r) => r.data),
  terminateAgreement: (id: string, reason?: string) =>
    api.post<PortalAgreement>(`/portal/agreements/${id}/terminate`, { reason }).then((r) => r.data),

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
