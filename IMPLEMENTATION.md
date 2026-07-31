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

## Build log

- **Step 1**: Traefik gateway + Go/Python service skeletons (Docker Compose).
- **Step 2**: Postgres schema `users`, `teams`, `team_members` via golang-migrate.
- **Step 3 auth-service:**
    - 3a: config + Postgres/Redis wiring + liveness/readiness health.
    - 3b: register + login bcrypt, access JWT (HS256) + Redis-backed refresh token.
    - 3c: `/me` (JWT middleware), refresh-token rotation, logout.
    - 3d: `POST /api/auth/teams` create team + owner membership in one transaction.
- **Step 4** *(next)*: `task-service` boards & tasks with RBAC enforcement.
