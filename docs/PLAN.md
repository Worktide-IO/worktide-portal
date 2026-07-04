# Plan: Kundenportal — Phase 1 (Support-Portal: Tickets lesen/erstellen/antworten)

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
     **kuratierte DTOs** (id, title, statusLabel, dueOn, createdAt, projectName) — **kein**
     priorityScore/assignees/interne Felder.
   - `GET /v1/portal/tickets/{id}` → ein Ticket (via Resolver autorisiert) + öffentliche Kommentare
     (`isHiddenForConnectUsers = false`), Autor als Anzeigename.
   - `POST /v1/portal/tickets` → neuer `Task` in einem erlaubten Projekt (bei mehreren: `projectId`
     aus der erlaubten Menge im Body; bei genau einem: dieses; bei keinem: 409 „kein Portal-Projekt").
     `createdVia = portal`, Ersteller-Kontakt vermerkt, Status = Workspace-Default-Offen.
   - `POST /v1/portal/tickets/{id}/comments` → `Comment` (`isHiddenForConnectUsers = false`,
     Autor = Portal-User) am autorisierten Ticket.
6. **`createdVia`-Enum** um `Portal` erweitern (+ FE-Typ). Voraussichtlich **keine Schema-Migration**
   (nutzt linkedUser, roles, `Workspace.settings`, `PasswordResetToken`); nur falls `created_via` ein
   DB-Enum ist, kleine Migration.

### Absicherung & Modularität
7. **Firewall-Lockdown** (`config/packages/security.yaml`): `access_control` so, dass
   `^/v1/portal` → `ROLE_PORTAL`, `^/v1/auth` öffentlich/authentifiziert, und die bestehende
   `^/v1` → `ROLE_USER`-Baseline **alle Staff-Routen für Portal-User sperrt** (die haben kein
   ROLE_USER). Verifizieren, dass ein Portal-JWT auf `GET /v1/tasks`/`POST /v1/tasks` **403** bekommt.
8. **Toggle:** `Workspace.settings.portal = { enabled: bool, features: {...} }`. Alle Portal-Endpoints
   und die Freischaltung verweigern, wenn `enabled` fehlt/false. (Kein Schema — bestehendes JSON-Feld.)

---

## Frontend — neues Repo `../worktide-portal`
9. **Scaffold**: Vite + React + TS + Tailwind v4 + wenige shadcn/ui-Komponenten (Design-Tokens/Brand
   aus `worktide-web` kopieren, nicht importieren). Eigener `authProvider` (Passwort-Login, JWT/Refresh,
   eigene Storage-Keys `wtp.*`), `api`-Axios mit `VITE_API_BASE` (Dev: `https://api.worktide.ddev.site/v1`).
   Eigene DDEV-Config analog `worktide-web/.ddev/`.
10. **Seiten** (minimal, kein Staff-Sidebar): `/login`, `/set-password?token=`, `/tickets` (Liste),
    `/tickets/:id` (Detail + Kommentar-Thread + Antwortfeld), `/tickets/new`. Ruft ausschließlich
    `/v1/portal/*` + `/v1/auth/*`. Reduzierte, kundenfreundliche Sprache/Optik.
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
- Weitere Portal-Bausteine aus der Ideensammlung (Angebote, Monitoring, KI, Dateien, Digest).
