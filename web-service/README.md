# web-service

The browser client for the Task Manager SaaS: a clean, minimalist SPA that talks to the platform through the Traefik gateway (`/api/*`).

- **Stack:** React 19 + Vite 8 + TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first — tokens in `src/index.css` via `@theme`, no `tailwind config.js`)
- **Routing:** React Router v7 · **Server state:** TanStack Query v5 · **Session state:** React Context
- **Gateway route:** served at `/` (prod); the app only ever calls same-origin `/api/*`
- **Internal port:** `3000` (`FRONTEND_SERVICE_PORT`)

## How it's served

| Mode | How |
| ---- | --- |
| **Dev** | Vite dev server on `:3000`; `/api` is proxied to the gateway (`VITE_PROXY_TARGET`) so the browser stays same-origin; identical to prod. |
| **Prod** | Static build served by nginx (SPA fallback); Traefik routes `/` here and `/api/*` to the services. *(Docker/Traefik later)* |

Because everything is called as relative `/api/...`, no absolute API base URL is baked into the bundle.

## Project structure

```
src/
  main.tsx  App.tsx  index.css     # index.css = Tailwind entry + @theme design tokens
  types.ts                         # API DTO types (User, Team, Member, Board, Task, Role, TaskStatus)
  lib/
    api.ts                         # fetch wrapper: token store + 401→refresh→retry (single-flight)
    auth.ts                        # high-level auth actions (login/register/me/logout/listTeams)
  context/
    AuthContext.tsx                # session provider + boot-time hydration
  pages/       …                   # Login, Register, Teams, …
  components/   …                  # Layout, ProtectedRoute, RoleGate, ui/* 
```

## Auth & session model

- **Access token** kept in memory only (never written to disk).
- **Refresh token** stored in `localStorage`.
- **On boot** if a refresh token exists, the first `/me` call 401s and `api()` transparently refreshes (rotating the token) and retries, so sessions survive a page reload.
- **On any 401** a single-flight refresh runs (concurrent requests share one refresh), then the original request retries once; if refresh fails, the session is cleared.
- **Rotation-aware** the backend issues a new refresh token on every refresh; the client always persists the latest one.

> **Security note (POC):** `localStorage` is exposed to XSS. Fine for this demo. The production upgrade is an httpOnly, Secure, SameSite cookie for the refresh token (needs auth-service to set the cookie + CORS credentials + CSRF mitigation): a documented follow-up, not built here.

> **RBAC in the UI is cosmetic.** The client mirrors the permission catalog to hide/disable actions the caller can't perform, but the API is the source of truth and enforces every rule (403).

## Environment

Copy `.env.example` → `.env` and adjust:

| Variable            | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `VITE_APP_TITLE`    | App/document title                                                  |
| `VITE_PORT`         | Dev server port (default `3000`)                                    |
| `VITE_PROXY_TARGET` | Gateway **origin** the dev server proxies `/api` to (`http://localhost:8000`) |

> `VITE_PROXY_TARGET` must be the gateway origin **without** a trailing `/api`. The proxy rule already contributes the `/api` prefix, so including it would double the path (`/api/api/...`).

## Run

```bash
cd web-service
cp .env.example .env # if exists .env, skip
npm install
npm run dev          # http://localhost:3000 (needs the stack up: `make up`)
npm run build        # type-check + production build to dist/
npm run lint         # oxlint
```

## Backlog

- [-] **a** scaffold + auth foundation (api client, session, context).
- [ ] **b** teams: list + create, members with role badges (RBAC-gated).
- [ ] **c** boards: CRUD (RBAC-gated).
- [ ] **d** tasks: kanban CRUD + assign + status.
- [ ] **e** polish + Docker/nginx/Traefik integrated serving.
