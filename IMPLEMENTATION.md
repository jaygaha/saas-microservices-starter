# Implementation notes

Developer workflows and implementation detail, kept out of the README so that stays a quick overview.

## Make targets

- `make up` / `make down` start / stop the whole stack
- `make migrate` / `make migrate-down` apply / roll back DB migrations
- `make migrate-create name=<x>` scaffold a new migration pair
- `make migrate-force V=<n>` clear a "dirty" migration state
- `make sqlc` regenerate the type-safe DB layer from SQL
- `make smoke` health-check the running stack
- `make ps` / `make logs` / `make clean` status / logs / wipe volumes

## Database access: `sqlc`

`auth-service` uses **sqlc** to generate type-safe Go from
hand-written SQL: you edit SQL, not Go, for queries.

**Regenerate whenever you change** `auth-service/queries/*.sql`
**or** the schema (a migration that alters a table those queries
touch):

```bash
make sqlc # runs sqlc in Docker
cd auth-service && go mod tidy && go build ./...
```

- **Config:** `auth-service/sqlc.yaml`: `schema:` points at
`infra/database/migrations` (one source of truth); overrides map `citext → string` and `uuid → google/uuid`.
- **Queries:** `auth-service/queries/*.sql`, annotated `-- name: Name :one|:many|:exec` (no space after the `:`).
- **Output:** `auth-service/internal/db/`: **generated, checked in, never hand-edited.** Change the SQL and regenerate instead.
- The Postgres `uuid` codec is registered per-connection in `internal/store/store.go` so pgx can scan `google/uuid`.

## Migrations: `golang-migrate`

Versioned SQL in `infra/database/migrations/`, applied on demand via `make migrate`. Schema diagram and conventions live in  [`infra/database/README.md`](infra/database/README.md).

## Testing

- `make smoke`: gateway + service health.
- `./scripts/auth-smoke.sh`: full auth flow (register → login → /me → create team → refresh → logout). Override with `BASE=`, `EMAIL=`, `PASS=`, `TEAM=`.
- `./scripts/rbac-smoke.sh`: team RBAC (list members as owner / outsider / anon → 200 / 403 / 401). Override with `SLUG=`, `OWNER=`, `OUT=`.

## Build log

- **Step 1**: Traefik gateway + Go/Python service skeletons (Docker Compose).
- **Step 2**: Postgres schema `users`, `teams`, `team_members` via golang-migrate.
- **Step 3 auth-service:**
    - 3a: config + Postgres/Redis wiring + liveness/readiness health.
    - 3b: register + login bcrypt, access JWT (HS256) + Redis-backed refresh token.
    - 3c: `/me` (JWT middleware), refresh-token rotation, logout.
    - 3d: `POST /api/auth/teams` create team + owner membership in one transaction.
- **Step 4 RBAC / team management (auth-service):**
    - 4a: `internal/rbac` permission catalog + `requirePermission` middleware; list members.
    - 4b: add member by email (`POST .../members`, `member.invite`).
    - 4c: change role / remove member (`PATCH`/`DELETE .../members/{userID}`) with owner guards.
- **Step 5 task-service (boards & tasks, cross-service RBAC):**
    - 5a: boards create/list. Identity-only JWT verified with the shared `JWT_SECRET`; caller's role resolved directly from the shared `team_members` table (single `authz` seam); Python permission catalog mirrors Go's `internal/rbac`. Verified E2E: owner create 201 / list shows board; viewer create 403 /list 200; non-member 403; no-token 401.
    - 5b: board get / update / delete. Team resolved from the board (`board → team_id`); soft-delete via `deleted_at` → `204`; `board.delete` restricted to owner/admin.
      - Verified:
        - GET all-members 200 / non-member 403 / bogus 404
        - PATCH viewer 403, member+owner 200
        - DELETE viewer+member 403, owner 204, repeat + GET-after 404.
    - 5c: tasks CRUD + assign. Team resolved task → board → team; `task.assign` enforces a business rule (assignee must be a team member, else 400); partial PATCH via `COALESCE`; soft-delete → 204; task under a soft-deleted board → 404.
    - Verified E2E across owner/member/viewer/non-member (41 checks).
- [**Step 6 web-service**](web-service/README.md)
    - 6a: scaffold + auth foundation (api client, session, context).
    - 6b: teams: list + create, members with role badges (RBAC-gated).
    - 6c: boards: CRUD (RBAC-gated).
    - 6d: tasks: kanban CRUD + assign + status.
    - 6e: polish + Docker/nginx/Traefik integrated serving.
