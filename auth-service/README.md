# auth-service

Identity & access for the Task Manager SaaS: users, authentication (JWT), teams, and RBAC.

- **Language:** Go
- **Gateway route:** `/api/auth/*` — Traefik strips the prefix before forwarding
- **Internal port:** `8000` (not published to the host; reachable only via Traefik)

## Endpoints

| Method | Path      | Description             |
| ------ | --------- | ----------------------- |
| GET    | `/health` | Liveness check (JSON)   |
| GET    | `/`       | Echoes the request path |

Paths are what the service sees *after* prefix-stripping, e.g. `GET /api/auth/health` at the gateway → `GET /health` here.

## Environment

| Var            | Purpose                          |
| -------------- | -------------------------------- |
| `SERVICE_NAME` | Name shown in responses/logs     |
| `PORT`         | Listen port (default `8000`)     |
| `DATABASE_URL` | Postgres DSN (used from Step 2)  |
| `REDIS_URL`    | Redis DSN (used later)           |
| `JWT_SECRET`   | JWT signing key (used later)     |

## Run

```bash
# As part of the stack (from repo root):
make up
curl http://localhost:8020/api/auth/health

# Standalone (local Go, no Docker):
cd auth-service
PORT=8000 go run .
curl http://localhost:8000/health
```
