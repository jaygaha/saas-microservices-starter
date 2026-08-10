# task-service

The "work" domain for the Task Manager SaaS: **boards** and **tasks**.

- **Language:** Python (FastAPI + asyncpg, hand-written SQL — no ORM)
- **Gateway route:** `/api/tasks/*` — Traefik strips the prefix before forwarding
- **Internal port:** `8031` (compose sets `PORT`; not published to the host, reachable only via Traefik)

## Cross-service RBAC

task-service does **not** issue tokens. It trusts the identity-only access JWT minted by auth-service (same `JWT_SECRET`, HS256) for the caller's `user_id`, then resolves authority itself:

1. Verify the JWT → `user_id` (`security.current_user_id`).
2. Find the team (from `board.team_id`, later `task → board → team_id`).
3. Read the caller's role **directly** from the shared `team_members` table.
4. Check the permission catalog → `403` if not a member or not allowed.

Steps 3-4 live behind a single `authz` module: the one seam to change if we later split databases, move to team-scoped tokens, or adopt OPA. The permission catalog in `rbac.py` is a deliberate mirror of auth-service's Go `internal/rbac`.

## Endpoints

| Method | Path (external)          | Auth   | Permission     | Description                    |
| ------ | ------------------------ | ------ | -------------- | ------------------------------ |
| GET    | `/api/tasks/health`      | –      | –              | Liveness                       |
| GET    | `/api/tasks/health/ready`| –      | –              | Readiness (pings the DB pool)  |
| POST   | `/api/tasks/boards`      | Bearer | `board.create` | Create a board in a team       |
| GET    | `/api/tasks/boards?team_id=` | Bearer | `board.view` | List a team's boards          |
| GET    | `/api/tasks/boards/{id}` | Bearer | `board.view`   | Get one board                  |
| PATCH  | `/api/tasks/boards/{id}` | Bearer | `board.update` | Rename a board                 |
| DELETE | `/api/tasks/boards/{id}` | Bearer | `board.delete` | Soft-delete a board (`204`)    |
| POST   | `/api/tasks/tasks`             | Bearer | `task.create` | Create a task in a board         |
| GET    | `/api/tasks/tasks?board_id=`   | Bearer | `task.view`   | List a board's tasks             |
| GET    | `/api/tasks/tasks/{id}`        | Bearer | `task.view`   | Get one task                     |
| PATCH  | `/api/tasks/tasks/{id}`        | Bearer | `task.update` | Update title/description/status  |
| PATCH  | `/api/tasks/tasks/{id}/assign` | Bearer | `task.assign` | Assign / unassign a task         |
| DELETE | `/api/tasks/tasks/{id}`        | Bearer | `task.delete` | Soft-delete a task (`204`)       |


- `POST /boards` body: `{"team_id": "<uuid>", "name": "..."}` → `201 {id, team_id, name, created_by}`.
- `GET /boards?team_id=<uuid>` → `200 {"boards": [{id, team_id, name, created_by}, ...]}`.
- `PATCH /boards/{id}` body: `{"name": "..."}` → `200 BoardOut`. 
- `DELETE /boards/{id}` → `204`(soft delete). For `{id}` routes the team is resolved from the board itself, so a non-member gets `403` and an unknown/deleted board gets `404`.
- `POST /tasks` body `{board_id, title, description?}` → `201 TaskOut` (status defaults `todo`).
- `PATCH /tasks/{id}` accepts any of `{title, description, status}` with `status ∈ {todo, in_progress, done}`.
- `PATCH /tasks/{id}/assign` body `{assignee_id}` (or `null` to unassign): the assignee must belong to the task's team, else `400`. A task under a soft-deleted board is `404` (the team is resolved task → board → team).

## Permissions (RBAC matrix)

| Permission     | owner | admin | member | viewer |
| -------------- | :---: | :---: | :----: | :----: |
| `board.view`   |   ✓   |   ✓   |   ✓    |   ✓    |
| `board.create` |   ✓   |   ✓   |   ✓    |   ✗    |
| `board.update` |   ✓   |   ✓   |   ✓    |   ✗    |
| `board.delete` |   ✓   |   ✓   |   ✗    |   ✗    |
| `task.view`    |   ✓   |   ✓   |   ✓    |   ✓    |
| `task.create`  |   ✓   |   ✓   |   ✓    |   ✗    |
| `task.update`  |   ✓   |   ✓   |   ✓    |   ✗    |
| `task.delete`  |   ✓   |   ✓   |   ✓    |   ✗    |
| `task.assign`  |   ✓   |   ✓   |   ✓    |   ✗    |

## Environment

| Variable       | Purpose                                                  |
| -------------- | -------------------------------------------------------- |
| `PORT`         | Uvicorn listen port (compose sets `8031`)                |
| `DATABASE_URL` | Postgres DSN — the **shared** platform DB                |
| `JWT_SECRET`   | HS256 key, **shared with auth-service** to verify tokens |
| `REDIS_URL`    | Reserved (optional short-TTL role cache; unused so far)  |

## Run

```bash
# As part of the stack (from repo root):
make up
curl http://localhost:8020/api/tasks/health

# Standalone (local, no Docker):
cd task-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PORT=8001 uvicorn main:app --reload --port 8001
curl http://localhost:8001/health
```
