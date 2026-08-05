# auth-service

Identity & access for the Task Manager SaaS: users, authentication (JWT), teams, and RBAC.

- **Language:** Go
- **Gateway route:** `/api/auth/*` Traefik: strips the prefix before forwarding
- **Internal port:** `8000` by default (set via `AUTH_SERVICE_PORT`); not published to the host; reachable only via Traefik

## Endpoints

Paths are what the service sees *after* Traefik strips `/api/auth` (e.g. `POST /api/auth/login` → `POST /login`).

| Method | Path                               | Auth          | Description |
| ------ | ---------------------------------- | ------------- | ----------|
| GET    | `/health`                          | –             | Liveness: the process is up |
| GET    | `/health/ready`                    | –             | Readiness: Postgres + Redis reachable (503 if not) |
| POST   | `/register`                        | –             | Create a user; returns tokens (**201**) |
| POST   | `/login`                           | –             | Verify credentials; returns tokens (**200**) |
| GET    | `/me`                              | Bearer        | The current user |
| POST   | `/teams`                           | Bearer        | Create a team + owner membership (**201**) |
| GET    | `/teams/{teamID}/members`          | Bearer        | List members (`member.view`) |
| POST   | `/teams/{teamID}/members`          | Bearer        | Add an existing user by email (`member.invite`; **201**) |
| PATCH  | `/teams/{teamID}/members/{userID}` | Bearer        | Change a member's role (`member.update_role`; **204**) |
| DELETE | `/teams/{teamID}/members/{userID}` | Bearer        | Remove a member (`member.remove`; **204**) |
| POST   | `/refresh`                         | refresh token | Rotate: revoke the sent refresh token, return new ones |
| POST   | `/logout`                          | refresh token | Revoke a refresh token (**204**) |

`/me` and `/teams*` need `Authorization: Bearer <access_token>`. `/refresh` and `/logout` take `{"refresh_token": "..."}`. `/teams` takes `{"name": "..."}`; `POST …/members` takes `{"email", "role"}`; `PATCH `{"role"}` (admin|member|viewer).

## Permissions (RBAC)

Team endpoints are authorized by the caller's **role in that team** — resolved per request from `team_members` (non-members get **403**). Roles: `owner`, `admin`, `member`, `viewer`.

| Permission | owner | admin | member | viewer |
|---|:--:|:--:|:--:|:--:|
| `member.view` (list) | ✓ | ✓ | ✓ | ✓ |
| `member.invite` (add) | ✓ | ✓ | ✗ | ✗ |
| `member.update_role` (change role) | ✓ | ✓\* | ✗ | ✗ |
| `member.remove` | ✓ | ✓\* | ✗ | ✗ |

\* On top of RBAC, **owner guards** apply: admins can't modify/remove the owner, only an owner grants the owner role, and the last owner can't be removed or demoted.

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
