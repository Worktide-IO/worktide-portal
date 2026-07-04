# Plan: Kundenportal — Phase 1 (Support-Portal: Tickets lesen/erstellen/antworten)

> Design-Referenz: `wireframes/WIREFRAMES.md` (8 Screens) · Abgleich Wireframe↔Plan mit
> verifizierten Backend-Fakten: `RECONCILIATION.md`.

## Context

Roadmap-Phase E: pro Workspace ein Kundenportal, in dem freigeschaltete CRM-Kontakte eine
**strikt reduzierte Sicht** bekommen (kein Workspace-Zugang). Das Datenmodell antizipiert das
bereits: `Contact.linkedUser` (Kontakt↔Login), `Project.isExternal` (portal-sichtbar),
`isHiddenForConnectUsers` auf Task/Comment/File/Doc (in Votern durchgesetzt), Magic-Link/Token-
Infra (`PasswordResetService`, `WorkspaceInvitation`), JWT+Refresh.

**Kritische Sicherheitsgrenze:** `WorkspaceScopeExtension` (src/ApiPlatform/Doctrine/) filtert **alle**
Standard-Collections per `EXISTS(workspace_members WHERE user = current_user)`. Ein Portal-Kontakt ist
bewusst **kein** Workspace-Mitglied → sähe über die Staff-Endpoints nichts. Das Portal bekommt daher
**eigene, portal-gescopte Endpoints** mit kuratierten DTOs (nie die vollen Entities), und Portal-User
werden per Firewall auf `^/v1/portal` + Auth eingesperrt.

**Entscheidungen des Users:** voller Support-Loop (lesen + erstellen + antworten) · Passwort-Login
(Einladung → Passwort setzen) · Portal-Frontend als **separates Repo/App** (`../worktide-portal`).

Ticket = **Task** in einem `isExternal`-Projekt des Kunden (das `isHiddenForConnectUsers`-Gating ist
genau dafür gebaut). Fixe Portal-Rechte in P1; die granulare Capability×Role-Matrix pro Kontakt
(Rechnungen etc.) kommt später.

---

## Backend (`worktide`)

### Identität, Login, Freischaltung
1. **Portal-User = eigener `User` mit Rolle `ROLE_PORTAL` (ohne `ROLE_USER`)**, verknüpft über
   `Contact.linkedUser`. Kein `WorkspaceMember`. Prüfen: `User::getRoles()` (src/Entity/User.php)
   darf `ROLE_USER` **nicht** bedingungslos anhängen — sonst greift die Firewall-Sperre unten nicht;
   ggf. so anpassen, dass die gespeicherten Rollen maßgeblich sind.
2. **Freischalten (Staff-Action):** `POST /v1/contacts/{id}/grant-portal-access` (Security `EDIT` auf
   `contact.workspace`): legt bei Bedarf einen `User` an (unbrauchbares Zufallspasswort, Rollen
   `[ROLE_PORTAL]`), setzt `Contact.linkedUser`, und verschickt eine **Passwort-setzen-Mail** über den
   vorhandenen `PasswordResetService` (neues Twig-Template `email/portal_set_password`). Dazu
   `POST /v1/contacts/{id}/revoke-portal-access` (linkedUser lösen / deaktivieren). Muster:
   `ForgotPasswordController` + `WorkspaceInvitationAcceptController`.
3. **Login:** unverändert `POST /v1/auth/login` (E-Mail+Passwort → JWT+Refresh) + `/auth/refresh` —
   dieselbe Firewall, kein neuer Code. Passwort setzen via bestehendem `POST /v1/auth/reset-password`.

### Portal-Endpoints (dediziert, umgehen WorkspaceScopeExtension bewusst)
4. **`PortalAccessResolver`** (neu, `src/Service/Portal/`): aus dem aktuellen User → `Contact`
   (via `linkedUser`, muss `ROLE_PORTAL` sein) → `Customer` → erlaubte Projekte
   (`customer.projects` mit `isExternal = true`). Prüft `workspace.settings.portal.enabled`. Methoden:
   `contact()`, `customer()`, `allowedProjects()`, `assertCanSeeTask(Task)`, `assertCanComment(Task)`
   (Task muss in einem erlaubten Projekt liegen **und** `!isHiddenForConnectUsers`).
5. **`PortalController`** (neu, `src/Controller/Api/Portal/`, alle Routen `^/v1/portal`, `ROLE_PORTAL`):
   - `GET /v1/portal/me` → `{ contact, customer, workspaceName, features }` (kuratiert).
   - `GET /v1/portal/tickets` → Tasks der erlaubten Projekte, ohne `isHiddenForConnectUsers`, als
     **kuratierte DTOs** (id, **identifier**, title, statusLabel, **priorityLabel**, dueOn, createdAt,
     projectName). `identifier` = `Task.identifier` (VARCHAR 24, Form `WORK-142`, existiert bereits) →
     der Ticket-Key aus dem Wireframe. `priorityLabel` aus `Task.priority` (`TaskPriority`) — im
     Wireframe als Hoch/Mittel/Niedrig-Badge. Weiterhin **kein** assignees/interne Felder. **Nicht in
     P1:** die SLA-Spalte (SLA hängt an `CustomerAgreement`, nicht am Task) → weglassen. „Wartet auf
     mich"-Filter erst, wenn ein passender `TaskStatus` workspaceseitig existiert; P1 liefert
     Alle/Offen/Erledigt.
   - `GET /v1/portal/tickets/{id}` → ein Ticket (via Resolver autorisiert) + öffentliche Kommentare
     (`isHiddenForConnectUsers = false`), Autor als Anzeigename.
   - `POST /v1/portal/tickets` → neuer `Task` in einem erlaubten Projekt (bei mehreren: `projectId`
     aus der erlaubten Menge im Body; bei genau einem: dieses; bei keinem: 409 „kein Portal-Projekt").
     `createdVia = portal`, Ersteller-Kontakt vermerkt, Status = Workspace-Default-Offen. Body-Felder:
     `title`, `description`, optional `priority` (aus `TaskPriority`; Default `Normal`), ggf. `projectId`.
     **Nicht in P1:** Datei-Anhang (📎) beim Erstellen und KI-Strukturierung (Freitext → Titel/Priorität/
     Projektzuordnung, via `AIRecommendation`/Anthropic) — P1 ist ein reines Textformular.
   - `POST /v1/portal/tickets/{id}/comments` → `Comment` (`isHiddenForConnectUsers = false`,
     Autor = Portal-User) am autorisierten Ticket.
6. **`createdVia`-Enum** (`src/Entity/Enum/TaskCreatedVia.php`) um `Portal` erweitern (+ FE-Typ).
   Voraussichtlich **keine Schema-Migration**
   (nutzt linkedUser, roles, `Workspace.settings`, `PasswordResetToken`); nur falls `created_via` ein
   DB-Enum ist, kleine Migration.

### Absicherung & Modularität
7. **Firewall-Lockdown** (`config/packages/security.yaml`): `access_control` so, dass
   `^/v1/portal` → `ROLE_PORTAL`, `^/v1/auth` öffentlich/authentifiziert, und die bestehende
   `^/v1` → `ROLE_USER`-Baseline **alle Staff-Routen für Portal-User sperrt** (die haben kein
   ROLE_USER). Verifizieren, dass ein Portal-JWT auf `GET /v1/tasks`/`POST /v1/tasks` **403** bekommt.
8. **Toggle:** `Workspace.settings.portal = { enabled: bool, features: {...} }`. Alle Portal-Endpoints
   und die Freischaltung verweigern, wenn `enabled` fehlt/false. (Kein Schema — bestehendes JSON-Feld.)
   **`features`-Namespace jetzt festlegen** (Contract-Stabilität über alle Phasen), auch wenn P1 nur
   `tickets` implementiert: `{ tickets, dashboard, monitoring, agreements, ideas, social, forms,
   documents }` (alle `bool`; in P1 alles außer `tickets` = false). `GET /v1/portal/me → { …, features }`
   liefert die Map; das FE rendert daraus die Navigation. Die Keys spiegeln die 8 Wireframe-Screens und
   haben — außer `tickets` — bereits Backend-Entities (siehe `RECONCILIATION.md`), sind später also
   „DTO über bestehende Entity", kein neues Subsystem.

---

## Frontend — neues Repo `../worktide-portal`
9. **Scaffold**: Vite + React + TS + Tailwind v4 + wenige shadcn/ui-Komponenten (Design-Tokens/Brand
   aus `worktide-web` kopieren, nicht importieren). Eigener `authProvider` (Passwort-Login, JWT/Refresh,
   eigene Storage-Keys `wtp.*`), `api`-Axios mit `VITE_API_BASE` (Dev: `https://api.worktide.ddev.site/v1`).
   Eigene DDEV-Config analog `worktide-web/.ddev/`.
10. **Seiten**: `/login`, `/set-password?token=`, `/tickets` (Liste), `/tickets/:id` (Detail +
    Kommentar-Thread + Antwortfeld), `/tickets/new`. Ruft ausschließlich `/v1/portal/*` + `/v1/auth/*`.
    Reduzierte, kundenfreundliche Sprache/Optik. **Navigation wie im Wireframe** (Dashboard, Tickets,
    Monitoring, Angebote & Verträge, Ziele & Ideen, Wissen/Dateien, Einstellungen), aber alle
    Nicht-Ticket-Einträge **gesperrt/„demnächst"** anhand `features` aus `/portal/me` — so passt die
    Optik zum Wireframe und die spätere Freischaltung braucht keinen FE-Umbau.
11. **Staff-Seite (`worktide-web`)**: auf der Kontakt-Detailansicht ein „Portal-Zugang freischalten/
    entziehen"-Button (ruft die Grant/Revoke-Action); Badge „Portal aktiv" wenn `linkedUser` gesetzt.
    Plus ein Workspace-Setting-Schalter „Kundenportal aktiv".

---

## Verifikation

**Backend (DDEV, curl/Tests):**
- Kontakt freischalten → Passwort-setzen-Mail landet in Mailpit (`worktide.ddev.site:8026`); Passwort
  via `/auth/reset-password` setzen; `/auth/login` liefert JWT.
- Mit Portal-JWT: `GET /v1/portal/tickets` zeigt **nur** Tickets des eigenen Kunden aus `isExternal`-
  Projekten, ohne hidden/interne Felder; `GET /v1/portal/tickets/{fremd}` → 403/404; `POST` legt Task
  an (taucht danach in der Liste auf); Kommentar posten → sichtbar; hidden Kommentare bleiben unsichtbar.
- **Negativ:** Portal-JWT auf `GET /v1/tasks` und `POST /v1/tasks` → **403**; bei
  `portal.enabled=false` → alle Portal-Endpoints 403; Staff-User (ROLE_USER) auf `^/v1/portal` → 403.
- Bestehende 154 PHP-Tests grün + neue Tests für `PortalAccessResolver` (Cross-Customer-Isolation) und
  die Endpoints.

**Frontend (neues Repo):** `tsc`+Build grün; Dev-Login mit dem freigeschalteten Kontakt; Tickets-Liste/
Detail/Neu/Antwort end-to-end gegen die lokale API (Chrome DevTools MCP, singleton + Cachebust).
Gegenprobe: Staff-Login funktioniert im Portal **nicht** (kein ROLE_PORTAL).

## Nicht in Scope (spätere Phasen)
- Granulare Capability×Role-Matrix pro Kontakt (Rechnungen/Monitoring/Verträge sichtbar schalten).
- Magic-Link/SSO-Login, eigene Domain-Auslieferung/Branding pro Workspace, Mercure-Live-Updates.
- **Tickets-Screen, aus P1 zurückgestellt:** SLA-Spalte, Datei-Anhang beim Erstellen, KI-Strukturierung,
  @Mention, „Wartet auf mich"-Filter (siehe §5). (Ticket-Keys „WORK-142" sind via `Task.identifier`
  bereits in P1 dabei.)
- **Weitere Wireframe-Screens (2–8)** hinter `features`-Flags. Anders als früher angenommen meist
  „Portal-DTO über bestehende Entity", kein neues Subsystem — Backing laut `RECONCILIATION.md`:
  Monitoring (`CustomerSystem`+`InboundEvent`), Angebote/Verträge (`CustomerAgreement`+`ServiceSubscription`),
  Social (`SocialPost`), Fragebogen (`PublicForm`+`PublicFormSubmission`), Pitch (`AIRecommendation`),
  Dateien (`Document*`). **Echt net-new:** kundenseitige Invoice, KPI-Goal, Idea/Vote.

---

## Umgesetzt nach P1 — Monitoring · Live-Metriken (Screen 3)

> Ausgeliefert 2026-07-04 (worktide `main` `df166cf`, worktide-portal `main` `d5acc10`).
> **Abweichung vom P1-Vorausblick:** oben stand Monitoring = `CustomerSystem`+`InboundEvent`.
> Tatsächlich gebaut wurde ein eigenes, schlankes Uptime-/Incident-Subsystem (kein InboundEvent) —
> `CustomerSystem` bleibt die Inventar-Quelle, Metriken/Störungen kommen aus neuen Entities.

**Backend (`worktide`):**
- **`SystemUptimeDay`** (net-new) — ein Tages-Rollup pro `CustomerSystem`: `uptimePct` (0–100),
  `avgResponseMs`, `sampleCount`; Unique (system, day). Repo: `findSince(systems, since)`,
  `findOneForDay(system, day)`.
- **`SystemIncident`** + **`IncidentKind`** (`outage`/`degraded`/`maintenance`, net-new) — die Liste
  „Vorfälle & Wartung". Ein **offener** Incident (`resolvedAt = null`) bestimmt den Live-Status
  (Outage → Störung, Degraded → Langsam, Maintenance → Wartung, sonst → Online). Repo:
  `findOpenOfKind`, `findRecentForSystems`.
- **`app:monitoring:probe`** (Command) — HTTP-Probe je aktivem System mit URL (Timeout 8 s):
  up / degraded (>2000 ms) / down (≥400 od. Fehler); schreibt/aktualisiert den heutigen
  `SystemUptimeDay` und öffnet/schließt Outage-/Degraded-Incidents automatisch. Wartungsfenster
  werden von Staff angelegt.
- **`PortalSystemsController`** (`GET /v1/portal/systems`, Feature-Gate `monitoring`) liefert je System
  `status`/`statusLabel`, `uptimePct` + `avgResponseMs` (Ø über 30 Tage), `uptimeDays`
  (Sparkline-Serie) und die `incidents`-Liste. **Sicherheit unverändert:** DTO lässt
  `credentialsNotes`/`notes`/`adminLoginUrl`/`stagingUrl` weg.
- Migration `Version20260704143245`; Functional-Test in `PortalEndpointsTest` (abgeleiteter Status,
  Aggregate, Secret-Weglassung); Suite 172 Tests grün.

**Frontend (`worktide-portal`):** `SystemsPage` gerendert mit Status-Punkt + Badge, Uptime %/Latenz,
30-Balken-Uptime-Sparkline, Offene-Störung-Banner und „Vorfälle & Wartung"-Liste. Typen in
`src/lib/portal.ts` (`PortalSystem` erweitert, neu `PortalSystemIncident`).

**Offene Follow-ups (Monitoring):**
- ~~**Probe schedulen**~~ ✓ erledigt — `.ddev/web-build/worktide-monitoring-probe.cron` fährt
  `app:monitoring:probe` alle 5 Min. (288 Checks/Tag = dimensionierter `sampleCount`); wird vom
  Dockerfile-Glob `./*.cron` aufgenommen. Aktiv nach Web-Image-Rebuild (`ddev restart` / Deploy).
  **Lokal bewusst nicht aktiviert:** die Demo-Systeme zeigen auf Platzhalter-URLs, die der Probe
  auf „down" flippen und den kuratierten Seed überschreiben würde.
- ~~**„Zeitraum: 30 Tage ▾"-Selektor**~~ ✓ erledigt — `GET /v1/portal/systems?days=` nimmt 7/30/90
  (sonst Fallback 30), liefert `windowDays` + `availableWindows`; `SystemsPage` hat den Selektor,
  Sparkline-Balken + %/Latenz-Labels folgen der Auswahl.

---

## Umgesetzt nach P1 — Dashboard (Screen 1)

> Ausgeliefert 2026-07-04. Der bisherige `PortalDashboardController` lieferte nur Offene-Tickets +
> Projektfortschritt + Systeme-Zähler; Budget/Blocker/Aktivität waren als „kein ehrlicher Datenquell"
> zurückgestellt. Jetzt sind alle Wireframe-Abschnitte real hinterlegt (kein Fake-Datensatz).

**Backend (`worktide`, `PortalDashboardController`):** die Antwort enthält jetzt zusätzlich
- `customerName` (Begrüßung „Willkommen zurück, …", aus `PortalAccessResolver::customer()`),
- `budget` — **Retainer-Kachel**: getrackte Minuten **diesen Monat** (`TimeEntryRepository::sumMinutesForProjectsSince`)
  über der Summe der `budgetMinutes` der `isRetainer`-Projekte des Kunden. `null`, wenn kein
  Retainer-Projekt mit Budget existiert. **Ehrliche Einschränkung:** es gibt kein dediziertes
  Monats-Kontingent-Feld; `Project.budgetMinutes` wird als Monats-Allowance gelesen (natürliche
  Retainer-Semantik) — ein eigenes Feld ist ein späterer Refinement.
- `systems.openIncidents` — Anzahl offener Störungen (Zeile „aktiv · N Störung(en)").
- `blockers` — sichtbare, offene Tickets mit **offenem Vorgänger** über `TaskDependency`
  (`TaskRepository::findBlockedPortalTickets`, spiegelt die `isBlocked`-Semantik des
  `PriorityScoreCalculator`, re-appliziert `isHiddenForConnectUsers`).
- `activity` — kuratierter Feed aus `DomainEventLog`, **strikt** auf sichtbare Ticket-IDs gescoped
  (`DomainEventLogRepository::findRecentForAggregate`), Event-Namen ge-whitelistet
  (`task.created`/`task.updated`), Actor auf **„Sie"/„Agentur"** reduziert (nie Staff-PII), Payload
  verworfen.
- Functional-Test in `PortalEndpointsTest` (Budget-%, Blocker-Erkennung, Actor-Redaction); Suite 174 grün.

**Frontend (`worktide-portal`, `DashboardPage`):** Begrüßung mit Kundenname, drei KPI-Kacheln
(Offene Tickets · Budget diesen Monat mit Fortschrittsbalken · System-Status mit Störungs-Zeile),
Projektfortschritt, **Blocker**-Sektion (bernstein, klickbar) und **Aktivität**-Timeline mit
deutscher Relativzeit.

**Offene Follow-ups (Dashboard):**
- **🔔 Benachrichtigungen** (Wireframe-Glocke) — kein Notifications-Endpoint; separates Thema.
- **Per-Contact Capability×Role-Gating** — die Budget-Kachel ist derzeit nur datengetrieben sichtbar
  (Retainer vorhanden), nicht pro Kontakt schaltbar (bewusst zurückgestellt, siehe „Nicht in Scope").
- **Aktivität aus Kommentaren** — aktuell nur Task-Events; `comment.created` bräuchte Auflösung
  Comment→Task inkl. `isHiddenForConnectUsers`-Prüfung.

---

## Umgesetzt nach P1 — Angebots-/Vertrags-Positionen (Screen 4)

> Ausgeliefert 2026-07-04. Der P1-Stand zeigte nur „Positionsdetails … folgen" (Positionen lagen
> nur im PDF). Jetzt sind Positionen + Summe echt modelliert.

**Backend (`worktide`):** net-new **`AgreementLineItem`** — eine bepreiste Position einer
`CustomerAgreementRevision` (ManyToOne, CASCADE): `description`, `quantity`, `unitAmountCents`,
`currency`, `isRecurring`, `position`; Zeilensumme = `quantity × unitAmountCents`. Positionen hängen
an der Revision (Angebots-Terme bleiben über Nachverhandlungen korrekt). `PortalAgreementsController`
liefert je Angebot `lineItems`, `totalCents`, `currency` und `totalIsRecurring` (alle Zeilen monatlich
→ Monatssumme) aus der in-force-Revision (`currentRevision ?? pendingRevision`). Migration
`Version20260704152843`; Functional-Test (Zeilen, Summe, Mengen-Rechnung). Suite 175 grün.
**Weiterhin offen:** Rechnungen (kein Invoice-Modell).

**Frontend (`worktide-portal`, `AgreementsPage`):** Positions-Tabelle je Angebot/Vertrag mit
Mengen-Präfix, Zeilenbeträgen und „Summe / Monat (netto)"- bzw. „Summe (netto)"-Zeile.

---

## Umgesetzt nach P1 — Ticket-SLA-Spalte (Screen 2)

> Ausgeliefert 2026-07-04. In P1 bewusst zurückgestellt („SLA hängt an CustomerAgreement, nicht am
> Task", siehe §5). Es gibt weiterhin **kein** strukturiertes SLA-Vertragsmodell (der „sla"-
> AgreementType ist nur ein Dokument). Daher ist die SLA **abgeleitet**, nicht aus einem Vertrag gelesen.

**Backend (`worktide`):** net-new Service **`PortalSlaCalculator`**. Er berechnet je Ticket ein
SLA-Ziel aus einer **Default-Policy pro Priorität** (Std.: urgent 2 · high 4 · normal 24 · low 72),
pro Workspace via `settings.portal.sla` ({priority: hours}) überschreibbar (0/null → keine SLA). Der
Status kommt aus echten Timestamps: offen + Frist in der Zukunft → `due` („in 4 Std."/„in 2 Tagen"),
offen + überfällig → `overdue`, abgeschlossen ≤ Frist → `met` („erfüllt"), abgeschlossen > Frist →
`missed`, keine SLA → `none` („—"). `PortalTicketsController` liefert `sla {status,label,dueAt}` in
Liste + Detail. Unit-Test `PortalSlaCalculatorTest` (alle Zustände + Label-Formate). Suite 181 grün.

**Frontend (`worktide-portal`):** SLA-Spalte in der Ticket-Liste (`SlaBadge`, farbcodiert:
grau fällig · rot überschritten/verpasst · grün erfüllt; „—" ausgeblendet) und eine „SLA: …"-Zeile
im Ticket-Detail.

**Ehrliche Einschränkung:** die Policy ist ein sinnvoller Default keyed auf Priorität, kein
kundenspezifischer SLA-Vertrag. Ein strukturiertes SLA-Modell (Reaktions-/Lösungszeiten pro
Agreement, Pausieren bei „wartet auf Kunde") bleibt späterer Ausbau.

---

## Umgesetzt nach P1 — Brainstorming-Board (Screen 5)

> Ausgeliefert 2026-07-04. Der „Brainstorming"-Abschnitt der Ziele-&-Ideen-Seite fehlte komplett
> (kein Modell). Jetzt gibt es ein echtes, kundengescopetes Notiz-Board.

**Backend (`worktide`):** net-new **`BrainstormNote`** — ein freier Beitrag auf dem Board eines
`Customer` (workspace-scoped): `body`, `origin` (wiederverwendet `IdeaOrigin`: customer/agency/ai),
`authorContact` (nullable) + denormalisierter `authorName`. **`PortalBrainstormController`**
(`GET/POST /v1/portal/brainstorm`, Feature-Gate `ideas`): Liste chronologisch, POST hängt einen
Beitrag des Portal-Users an (origin=customer, `isMine` im DTO). Kein Staff-`User` wird geleakt (nur
der Anzeigename). Migration `Version20260704155932`; Functional-Test (Liste, Append, isMine, origin).
Suite 182 grün.

**Frontend (`worktide-portal`, `IdeasPage`):** „Brainstorming"-Sektion mit chronologischem
Beitrags-Stream (farbcodierter Herkunfts-Punkt customer/agency/ai, KI-Badge auf AI-Beiträgen,
„Sie"-Hervorhebung eigener Beiträge) und einem „Beitrag schreiben…"-Composer.

**Offen:** KI-Moderation/-Zusammenfassung (Wireframe „🤖 KI moderiert") — das Board rendert
AI-Beiträge, erzeugt sie aber noch nicht automatisch; separates KI-Thema.

---

## Umgesetzt nach P1 — Ticket-Anhänge (Screen 2, „📎")

> Ausgeliefert 2026-07-04. In P1 zurückgestellt („Datei-Anhang beim Erstellen", §5). Jetzt können
> Kunden Dateien an ein Ticket hängen und herunterladen — auf der vorhandenen File-Infrastruktur.

**Backend (`worktide`):** net-new **`PortalAttachmentsController`** — portal-gescopte Endpoints
(`POST /v1/portal/tickets/{id}/attachments`, `GET …/{fileId}/content`), autorisiert über
`PortalAccessResolver::findTicketOr404` (Identitätskette + Hidden-Ticket-Gate). Ein Anhang ist ein
`File` (target=Task, targetId=Ticket) + `FileVersion`, gespeichert über die bestehende `FileStorage`
(Flysystem, lokal/MinIO), immer `isHiddenForConnectUsers=false`; Upload-Cap 10 MB. Der Download
streamt nur Anhänge, die zum Ticket gehören und nicht versteckt sind (ETag/Content-Disposition).
`PortalTicketsController::show` liefert zusätzlich `attachments[]`; neue Repo-Methoden
`FileRepository::findVisibleForTask` / `findVisibleTaskAttachment`. Functional-Test (Upload → Liste →
Download → Fremd-Ticket 404). Suite 183 grün. **Kein** Virenscan (wie im Rest des Systems).

**Frontend (`worktide-portal`):** `NewTicketPage` mit Datei-Auswahl (Upload nach Ticket-Erstellung),
`TicketDetailPage` mit „Anhänge"-Liste (Download via authentifiziertem Blob-Fetch) + „Datei anhängen".
Trigger als expliziter Button→`ref.click()` (robust) mit Fehlermeldung bei fehlgeschlagenem Upload.
