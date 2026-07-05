# Kundenportal — offene Aufgaben (Backlog)

> Stand 2026-07-04. Alle 8 Wireframe-Screens + Monitoring-Live-Metriken, Ticket-SLA (inkl.
> Staff-Editor), Dashboard (Budget/Blocker/Aktivität), Angebots-Positionen, Brainstorming,
> Ticket-Anhänge, KI-Ticket-Vorschlag und der UX-Feinschliff sind **gebaut & in `main`** (alle drei
> Repos). Details je Feature in [`PLAN.md`](./PLAN.md). Hier stehen die **noch offenen** Punkte —
> geordnet nach Aufwand/Abhängigkeit.

## Braucht neues Modell / Backend
- [x] **Rechnungen-Tab** (Angebote & Verträge) — ✓ erledigt 2026-07-05: net-new `Invoice`, aus
      lexoffice gespiegelt (`app:lexoffice:sync-invoices`), Portal-Sektion. Siehe PLAN.md.
      Offen/verschoben: PDF-Download (2. lexoffice-Hop `/invoices/{id}`→`/files/{id}`).
- [x] **Per-Customer strukturiertes SLA** — ✓ erledigt 2026-07-05: Reaktions- **und** Lösungszeiten je
      Priorität, `Customer.slaPolicy` überstuert Workspace-Default, Pause via `TaskStatus.isWaitingForCustomer`.
      Siehe PLAN.md. (Offen: per-Customer-Editor-UI + historische Pausen-Dauer statt Nur-Ist-Zustand.)
- [x] **Benachrichtigungen 🔔** — ✓ erledigt 2026-07-05 (Header-Glocke + Feed; derived, siehe PLAN.md).
- [x] **Per-Contact Capability×Role-Sichtbarkeit** — ✓ erledigt 2026-07-05: `Contact.portalHiddenFeatures`
      (Feature-Keys pro Kontakt ausblenden), `features()` = Workspace-Features minus diese; Staff-Toggles
      unter Kontakt → „Portal-Sichtbarkeit". Siehe PLAN.md. (Granularität = Feature-Key/Screen; feiner —
      z.B. einzelne Dashboard-Kachel — wäre späterer Ausbau.)
- [ ] **„Rückfrage stellen" auf einem Angebot** (Agreement-Verhandlung) + **KI-Klauselerklärung**.

## KI-gestützt (braucht `ANTHROPIC_API_KEY` + `EGRESS_ALLOW=llm`)
- [ ] **KI-Moderation/-Zusammenfassung** im Brainstorming-Board (Board rendert AI-Beiträge bereits,
      erzeugt sie aber nicht).
- [ ] **KI-Keyword-Vorschläge** im SEO-Fragebogen (Screen 8).
- [ ] **Ticket-KI-Vorschlag scharf schalten** — Code fertig (`PortalTicketSuggester`), nur Env-Config
      (API-Key + EgressGuard-Modul `llm`).

## Kleinere (brauchen Backend-Daten, daher nicht frontend-only)
- [ ] **Social:** Bildvorschau + Inline-Textbearbeitung vor Freigabe — keine Media-URLs / kein
      Update-Body-Endpoint (heute nur `mediaCount`).
- [ ] **Vorschläge:** Vorher/Nachher-Mockup — keine Mockup-URL im `ProjectProposal`.
- [ ] **Tickets:** @Mention im Antwort-Composer; „Wartet auf mich"-Filter (braucht passenden
      `TaskStatus`); Projekt-Picker bei neuem Ticket (braucht Projekt-Set in `/portal/me`).

## Ops / Config
- [ ] **Monitoring-Probe in Prod aktivieren** — der `ddev-cron`-Job
      (`app:monitoring:probe`, alle 5 Min.) liegt bereit; wird erst nach Web-Image-Rebuild
      (`ddev restart` / Deploy) aktiv. Lokal bewusst nicht aktiv (Demo-URLs sind Platzhalter).
