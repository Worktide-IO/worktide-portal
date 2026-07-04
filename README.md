# worktide-portal

Customer portal for **worktide** — a standalone SPA that gives freigeschaltete CRM
contacts a **strictly reduced, capability-gated view** (their support tickets), with
**no** access to the internal workspace. Served on its own domain in production.

> **Status: scaffold + plan.** This repo is a runnable starter (Vite + React + TS +
> Tailwind v4) with the auth/API skeleton and page stubs wired to the *planned*
> backend endpoints. The backend `/v1/portal/*` API does **not exist yet** — building
> it is step 1 (see [Next steps](#next-steps)). The full design is in
> [`docs/PLAN.md`](docs/PLAN.md).

## Why a separate app (not part of `worktide-web`)

The staff SPA (`worktide-web`) is one Refine monolith behind a single auth gate with a
full workspace sidebar. A customer must never see any of that. Keeping the portal in
its own repo/app gives it its own auth context, minimal layout, its own domain, and a
hard blast-radius boundary. See the "Entscheidungen" section in `docs/PLAN.md`.

## Architecture & key decisions

- **Ticket = Task** in an `isExternal` project of the contact's customer. The backend's
  existing `isHiddenForConnectUsers` gating (on Task/Comment/File/…) keeps internal
  items invisible.
- **Portal users are NOT workspace members.** Because the backend's
  `WorkspaceScopeExtension` filters every standard collection by
  `EXISTS(workspace_members WHERE user = current_user)`, a portal contact would see
  nothing through the staff API. The portal therefore talks to **dedicated
  `/v1/portal/*` endpoints** that return **curated DTOs** (never full entities) and
  scope by the contact's `linkedUser → Contact → Customer → external projects`.
- **Auth:** password login via the shared `POST /v1/auth/login` (JWT + refresh). The
  account carries `ROLE_PORTAL` (not `ROLE_USER`); the backend firewall pins portal
  users to `^/v1/portal` + auth. Initial password is set from an emailed link
  (`POST /v1/auth/reset-password`), sent by the staff "grant portal access" action.
- **Per-workspace toggle:** `Workspace.settings.portal.enabled` gates the whole thing.

## Backend contract (to be implemented in the `worktide` repo)

| Method & path | Purpose |
| --- | --- |
| `POST /v1/auth/login` | Password login → `{ token, refresh_token }` (exists) |
| `POST /v1/auth/reset-password` | Set initial password from email token (exists) |
| `GET /v1/portal/me` | `{ contact, customer, workspaceName }` |
| `GET /v1/portal/tickets` | `{ member: PortalTicket[] }` — curated |
| `GET /v1/portal/tickets/{id}` | ticket + public comments |
| `POST /v1/portal/tickets` | create a Task in an allowed external project |
| `POST /v1/portal/tickets/{id}/comments` | add a public reply |

The exact DTO shapes are in [`src/lib/portal.ts`](src/lib/portal.ts) and the endpoint
behaviour in [`docs/PLAN.md`](docs/PLAN.md). Staff-side actions (grant/revoke portal
access, the workspace toggle) also live in `worktide` / `worktide-web`.

## Getting started

```bash
pnpm install
cp .env.example .env        # point VITE_API_BASE at your worktide API
pnpm dev                    # http://localhost:5174
```

`pnpm build` runs `tsc -b && vite build`; `pnpm typecheck` type-checks only.

## Project structure

```
src/
  main.tsx                 App bootstrap (BrowserRouter)
  App.tsx                  Routes + auth gate (RequireAuth → PortalLayout)
  lib/api.ts               axios instance, JWT storage (wtp.* keys), interceptor
  lib/portal.ts            /v1/portal/* client + curated DTO types
  providers/authProvider.ts  password login / logout / set-password
  components/PortalLayout.tsx  minimal chrome (header + logout, no sidebar)
  pages/                   LoginPage, SetPasswordPage, TicketsList/Detail/New
```

## Next steps

1. **Backend (`worktide`)** — build `/v1/portal/*` + `PortalAccessResolver` + the
   firewall lockdown + grant/revoke actions + the `portal.enabled` toggle. This is the
   critical, security-sensitive part; do it first and test cross-customer isolation.
   Full spec: [`docs/PLAN.md`](docs/PLAN.md).
2. **Token refresh** — implement the 401 → `/auth/refresh` → replay flow in
   `src/lib/api.ts` (currently a TODO; mirror `worktide-web`'s authProvider).
3. **Multi-project create** — let the user pick a project when their customer has more
   than one external project (see the TODO in `NewTicketPage.tsx`).
4. **Dev/deploy** — add a ddev config (mirror `worktide-web/.ddev`) and wire the
   production domain + `VITE_API_BASE`.
5. **Later phases** — granular Capability×Role per contact, more portal modules
   (offers, monitoring, billing, AI). See the ideation doc in the `worktide` repo
   (`docs/customer-portal-ideas.md`).

## Related repos

- [`Worktide-IO/worktide`](https://github.com/Worktide-IO/worktide) — API backend (Symfony + API Platform).
- [`Worktide-IO/worktide-web`](https://github.com/Worktide-IO/worktide-web) — internal staff SPA (Refine).
