# Wireframes ↔ PLAN.md — Reconciliation

Reconciles the 8-screen design ([`wireframes/WIREFRAMES.md`](./wireframes/WIREFRAMES.md))
against the Phase-1 plan ([`PLAN.md`](./PLAN.md)). Backend facts verified against
`../worktide/src/Entity/` on 2026-07-04.

## TL;DR

1. **Scope agrees.** PLAN P1 = *Support-Portal, Tickets only* (read/create/reply). The
   other 7 wireframe screens map cleanly onto PLAN's own "Nicht in Scope" list — **no
   contradiction**.
2. **But PLAN's mental model of the later phases is too pessimistic.** PLAN calls them
   "weitere Portal-Bausteine" as if net-new. In fact the backend **already has entities**
   for almost all of them. Later portal phases are mostly *"curated DTO + `^/v1/portal`
   endpoint over an existing entity"* — not *"build the subsystem."*
3. **Only three wireframe concepts have no backend home:** customer-facing **Invoices**,
   **business KPI Goals**, and **Ideas/Voting**. Everything else is backed.
4. **P1 needs ~6 field-level decisions on the Tickets screen** (below) — the plan's
   curated DTO and the wireframe disagree on priority, SLA, ticket key, attachments,
   the "waiting on me" filter, and AI structuring.

---

## Screen-by-screen

| # | Screen | PLAN scope | Backend backing (verified) |
|---|--------|-----------|----------------------------|
| 1 | Dashboard | ❌ not in P1 | partial — tiles aggregate other entities; `Dashboard` entity exists but is staff-side |
| 2 | **Tickets** | ✅ **P1** | `Task` (+ `TaskStatus`, `TaskPriority`, `Comment`) — see gaps below |
| 3 | Monitoring | ❌ deferred | ✅ `CustomerSystem` + `InboundEvent` (matches the wireframe's own note) |
| 4 | Angebote & Verträge | ❌ deferred | ✅ `CustomerAgreement` (+`Revision`, `AgreementType`, `AgreementStatus`), `ServiceSubscription` — **but no Invoice entity** |
| 5 | Ziele & Ideen | ❌ deferred | partial — `ProjectMilestone` ≠ KPI goal; **no Idea/Vote entity** |
| 6 | Social-Freigabe | ❌ deferred | ✅ `SocialPost` + `SocialPostTarget` (fully backed) |
| 7 | Ideen-Pitch | ❌ deferred | ✅ `AIRecommendation` (variant-compare + accept→Angebot+Task orchestration is net-new logic) |
| 8 | SEO-Fragebogen | ❌ deferred | ✅ `PublicForm` + `PublicFormSubmission` — this **is** the "generischer Formular-Baustein" |

---

## P1 decisions — Tickets screen (Screen 2)

PLAN §5 specifies the list DTO as `id, title, statusLabel, dueOn, createdAt, projectName`
and **explicitly excludes** `priorityScore/assignees`. The wireframe shows more. Each row
below is a decision to make before implementing:

| Wireframe element | Backend reality | Conflict | Recommendation |
|-------------------|-----------------|----------|----------------|
| **Priorität** badge (Hoch/Mittel/Niedrig) in list **and** create form | `Task.priority` (`TaskPriority` enum, default `Normal`) **exists** | PLAN DTO omits priority | **Include** — data is already there; add `priorityLabel` to DTO + optional priority on `POST`. Low cost. |
| **Ticket key "WORK-142"** | ✅ `Task.identifier` (VARCHAR 24) **exists** — generated as `projectKey-number` (see `RunTaskSchedulesCommand`, `LinkResolverController`) | none | **Include** — expose `identifier` in the list DTO; no backend work. |
| **SLA** column (4 Std. / 1 Tag / erfüllt) | SLA lives on **`CustomerAgreement`**, not `Task` | no Task-level SLA | **Defer** — needs agreement→task SLA derivation; drop the column from P1. |
| **📎 Anhang** on create | `File` entity exists (with `isHiddenForConnectUsers`) | PLAN P1 has no upload path | **Defer** — confirm P1 create is text-only. |
| **"Wartet auf mich"** filter tab | `TaskStatus` is a configurable **entity**, not a fixed enum | needs a "waiting-on-customer" semantic | **Defer or map** — depends on whether a workspace has such a status. Verify per-workspace; P1 can ship Alle/Offen/Erledigt only. |
| **🤖 AI** turns freetext → title+priority+project | `AIRecommendation` + Anthropic SDK exist | PLAN P1 = **no AI** | **Defer** — P1 = plain create form. |
| **@Mention** in comments | `Comment` is polymorphic, no mention infra noted | extra | **Defer.** |

Note: `TaskCreatedVia` enum lives at `src/Entity/Enum/TaskCreatedVia.php` (PLAN §6 says
"createdVia-Enum" without the `Entity/` path) — still needs a `Portal` case added.

---

## Cross-cutting alignment

- **Feature flags already anticipated.** PLAN's `Workspace.settings.portal.features {…}`
  (§8) and `GET /v1/portal/me → { …, features }` (§5) directly model the wireframe's
  "Kacheln pro Workspace an-/abschaltbar" + Capability×Role visibility. **Recommend
  defining the `features` key namespace now** (`tickets`, `dashboard`, `monitoring`,
  `agreements`, `ideas`, `social`, `forms`, `documents`) even though only `tickets` is
  wired in P1 — so the FE nav can render locked/"coming soon" items and the `/me`
  contract stays stable across phases.
- **Left nav.** Wireframe shows the full 7-item nav on every screen; PLAN P1 says "kein
  Staff-Sidebar, minimal". Reconcile by rendering the full nav in P1 with non-ticket
  items **disabled/locked** (driven by `features`), rather than hiding them — matches the
  wireframe and needs no rework later.

## Genuinely net-new for later phases (no entity today)
- **Invoice / Rechnung** (Screen 4 "Rechnungen" tab) — no dedicated entity; either
  net-new or fed from an external billing system.
- **Business KPI Goal** (Screen 5 "Ziele 2026", e.g. Conversion +20 %) — `ProjectMilestone`
  is delivery-scoped, not a measurable KPI target.
- **Idea + Vote** (Screen 5 upvoting, Screen 7 idea intake) — no `Idea`/`Vote` entity;
  `AIRecommendation` covers AI-proposed items but not customer submission + voting.
