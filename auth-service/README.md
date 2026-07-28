# auth-service

Identity & access for the Task Manager SaaS: users, authentication (JWT), teams, and RBAC.

- **Language:** Go
- **Gateway route:** `/api/auth/*` Traefik strips the prefix before forwarding
- **Internal port:** `8000` by default (set via `AUTH_SERVICE_PORT`); not published to the host; reachable only via Traefik

## Endpoints

| Method | Path            | Description                                          |
| ------ | --------------- | --------------------------------------------------- |
| GET    | `/health`       | Liveness: the process is up                         |
| GET    | `/health/ready` | Readiness: Postgres + Redis reachable (503 if not)  |

Paths are what the service sees *after* prefix-stripping, e.g. `GET /api/auth/health/ready` at the gateway → `GET /health/ready` here. (Register/login.)

## Environment

Read at startup; the service **fails fast** if any is missing.

| Var            | Purpose                                             |
| -------------- | --------------------------------------------------- |
| `SERVICE_NAME` | Name shown in responses/logs (default `auth-service`) |
| `PORT`         | Listen port (default `8000`)                        |
| `DATABASE_URL` | Postgres DSN - required                             |
| `REDIS_URL`    | Redis DSN - required                                |
| `JWT_SECRET`   | JWT signing key - required (used for tokens later)  |

## Run

```bash
# As part of the stack (from repo root): the normal path:
make up
curl http://localhost:8020/api/auth/health/ready     # {"status":"ready",...}

# Standalone (local Go): needs Postgres + Redis running (e.g. `make up`)
# and the required env set:
cd auth-service
export DATABASE_URL="postgres://<user>:<pass>@localhost:5432/<db>?sslmode=disable"
export REDIS_URL="redis://:<pass>@localhost:6379/0"
export JWT_SECRET="dev-secret"
PORT=8000 go run .
curl http://localhost:8000/health/ready
```
