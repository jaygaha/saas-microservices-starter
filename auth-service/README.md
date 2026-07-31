# auth-service

Identity & access for the Task Manager SaaS: users, authentication (JWT), teams, and RBAC.

- **Language:** Go
- **Gateway route:** `/api/auth/*` Traefik: strips the prefix before forwarding
- **Internal port:** `8000` by default (set via `AUTH_SERVICE_PORT`); not published to the host; reachable only via Traefik

## Endpoints

Paths are what the service sees *after* Traefik strips `/api/auth` (e.g. `POST /api/auth/login` → `POST /login`).

| Method | Path            | Auth          | Description |
| ------ | --------------- | ------------- | ----------|
| GET    | `/health`       | –             | Liveness: the process is up |
| GET    | `/health/ready` | –             | Readiness: Postgres + Redis reachable (503 if not) |
| POST   | `/register`     | –             | Create a user; returns tokens (**201**) |
| POST   | `/login`        | –             | Verify credentials; returns tokens (**200**) |
| GET    | `/me`           | Bearer        | The current user |
| POST   | `/teams`        | Bearer        | Create a team + owner membership (**201**) |
| POST   | `/refresh`      | refresh token | Rotate: revoke the sent refresh token, return new ones |
| POST   | `/logout`       | refresh token | Revoke a refresh token (**204**) |

`/me` and `/teams` need `Authorization: Bearer <access_token>`. `/refresh` and `/logout` take `{"refresh_token": "..."}` in the body. `/teams` takes `{"name": "..."}` and returns `{"id","name","slug"}`.

## Tokens

- **Access token**: JWT (HS256, signed with `JWT_SECRET`), ~15 min, carries `sub` (user id) + `email`; sent as `Authorization: Bearer`.
- **Refresh token**: opaque random string, ~7 days, stored **hashed** in Redis (`refresh:<sha256>` → user id). Single-use: `/refresh` rotates it (old one revoked), `/logout` deletes it.

Response shape for register / login / refresh:

```json
{
  "user": {
    "id": "019fa734-d07c-7523-9bc6-5f18d9962ee1",
    "email": "alice@example.com",
    "full_name": "Alice"
  },
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

## Environment

Read at startup; the service **fails fast** if any is missing.

| Var            | Purpose                                                |
| -------------- | ------------------------------------------------------ |
| `SERVICE_NAME` | Name shown in responses/logs (default `auth-service`)  |
| `PORT`         | Listen port (default `8000`)                           |
| `DATABASE_URL` | Postgres DSN - required                                |
| `REDIS_URL`    | Redis DSN - required                                   |
| `JWT_SECRET`   | Signs & verifies access tokens - required              |

## Run

```bash
# As part of the stack (from repo root): the normal path:
make up
curl http://localhost:8020/api/auth/health/ready     # {"status":"ready",...}

# Exercise the whole auth flow (register/login/me/refresh/logout):
./scripts/auth-smoke.sh

# Standalone (local Go)
# needs Postgres + Redis running (e.g. `make up`) and env set
cd auth-service
export DATABASE_URL="postgres://<user>:<pass>@localhost:5432/<db>?sslmode=disable"
export REDIS_URL="redis://:<pass>@localhost:6379/0"
export JWT_SECRET="dev-secret"
PORT=8000 go run .
curl http://localhost:8000/health/ready
```
