# task-service

The "work" domain for the Task Manager SaaS: boards and tasks.

- **Language:** Python (FastAPI)
- **Gateway route:** `/api/tasks/*` — Traefik strips the prefix before forwarding
- **Internal port:** `8001` (not published to the host; reachable only via Traefik)

## Endpoints

| Method | Path       | Description             |
| ------ | ---------- | ----------------------- |
| GET    | `/health`  | Liveness check (JSON)   |
| GET    | `/{path}`  | Echoes the request path |

FastAPI also serves interactive docs at `/docs`. That works when hitting the service directly; behind the gateway it needs a `root_path` setting (a later refinement).

## Environment

| `PORT`         | Uvicorn listen port (default `8001`)|
| `DATABASE_URL` | Postgres DSN (used later)           |
| `REDIS_URL`    | Redis DSN (used later)              |
| `JWT_SECRET`   | JWT verification key (used later)   |

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