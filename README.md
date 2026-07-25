# Task Manager SaaS (learning build)

A minimal B2B task manager, built step by step to learn a polyglot microservice stack all in Docker:
  
  - **Traefik** (gateway) 
  - **Go** (auth) 
  - **Python/FastAPI** (tasks)
  - **PostgreSQL** 
  - **Redis**

## Architecture

```mermaid
graph TD
    Client["Client (browser)"]

    subgraph Entry ["Ingress / Gateway"]
        Traefik["Traefik (gateway)<br/>API host :8020 → :80<br/>dashboard host :8019 → :8080"]
    end

    subgraph Services ["Services (reachable ONLY via Traefik)"]
        FrontendService["frontend-service<br/><i>web UI · stack TBD</i><br/>:3000 · served at /"]
        AuthService["auth-service · Go<br/><i>users, JWT, teams, RBAC</i><br/>:8000"]
        TaskService["task-service · Python/FastAPI<br/><i>boards, tasks</i><br/>:8001"]
        NewService["➕ &lt;new-service&gt;<br/><i>any language</i><br/>:80xx · route
/api/&lt;x&gt;/*"]
    end

    subgraph Storage ["Data Layer"]
        Postgres[("PostgreSQL<br/>:5432")]
        Redis[("Redis<br/>:6379")]
    end

    Client -->|"GET / (page load)"| Traefik
    Client -->|"/api/auth/*"| Traefik
    Client -->|"/api/tasks/*"| Traefik
    Client -.->|"/api/&lt;x&gt;/*"| Traefik

    Traefik -->|"/ catch-all (lowest priority)"| FrontendService
    Traefik -->|"prefix stripped"| AuthService
    Traefik -->|"prefix stripped"| TaskService
    Traefik -.->|"just add labels"| NewService

    AuthService --> Postgres
    AuthService --> Redis
    TaskService --> Postgres
    TaskService --> Redis
    NewService -.-> Postgres
    NewService -.-> Redis

    classDef future stroke-dasharray: 5 5,stroke:#8888aa,color:#8888aa;
    classDef tbd stroke-dasharray: 4 3,stroke:#aa8855,color:#aa8855;
    class NewService future;
    class FrontendService tbd;

    Traefik -->|"/ catch-all (lowest priority)"| FrontendService
    Traefik -->|"prefix stripped"| AuthService
    Traefik -->|"prefix stripped"| TaskService
    Traefik -.->|"just add labels"| NewService

    AuthService --> Postgres
    AuthService --> Redis
    TaskService --> Postgres
    TaskService --> Redis
    NewService -.-> Postgres
    NewService -.-> Redis

    classDef future stroke-dasharray: 5 5,stroke:#8888aa,color:#8888aa;
    classDef tbd stroke-dasharray: 4 3,stroke:#aa8855,color:#aa8855;
    class NewService future;
    class FrontendService tbd;
```

Everything shares the `saas-net` Docker network. Traefik discovers each service
from its container **labels** (no hand-written routes) and strips the `/api/<x>`
prefix before forwarding, so each service serves clean paths (`/health`, not
`/api/auth/health`). The service ports (3000/3001) are **not** published to the
host — the only way in is through Traefik. Postgres and Redis *are* published
(5432/6379) for local-dev convenience.

## Services

| Service           | Tier | Language       | Route via gateway | Internal port | Domain |
| ----------------- | ---- | -------------- | ----------------- | ------------- | --------- |
| `frontend-service`| web  | TBD            | `/` (catch-all)   | 3000          | web UI |
| `auth-service`    | API  | Go             | `/api/auth/*`     | 8000          | users, auth, JWT, teams, RBAC |
| `task-service`    | API  | Python/FastAPI | `/api/tasks/*`    | 8001          | boards, tasks |

## Layout

```bash
.
├── .env / .env.example         # config & secrets (ports, DB creds, JWT)
├── Makefile                    # make up / down / ps / logs / clean ...
├── auth-service/               # Go: identity & access
│   ├── main.go
│   ├── go.mod
│   └── Dockerfile
├── frontend-service/           # frontend service
│   └── Dockerfile
├── task-service/               # Python/FastAPI: boards & tasks
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
└── infra/
    ├── compose.yaml            # the whole stack (profile: core)
    ├── gateway/
    │   ├── traefik.yml         # Traefik static config
    │   └── dynamic/            # Traefik dynamic config (later)
    └── database/
        └── init/               # Postgres init scripts (later)
```

## Configuration

All ports, DB credentials, and the JWT secret live in `.env` (copy from `.env.example`). Host-facing ports are configurable there; container-internal ports are fixed. Render the fully-resolved config any time with:

```bash
docker compose -f infra/compose.yaml --env-file .env config
```

## Run

```bash
make up      # build images + start the whole stack (detached)
make ps      # status — wait until all 5 containers are (healthy)
make logs    # follow logs from all services
make down    # stop & remove containers (keeps data volumes)
make clean   # stop & remove containers AND volumes (wipes DB/cache)
make help    # list all targets
```

## Verify (Step 1)

```bash
curl http://localhost:8020/api/auth/health     # {"service":"auth-service","status":"ok",...}
curl http://localhost:8020/api/tasks/health    # {"service":"task-service","status":"ok",...}
curl http://localhost:8020/api/tasks/boards    # echoes "path":"/boards" → prefix-stripping works
```

Dashboard: <http://localhost:8019/dashboard/> → **HTTP → Routers** should list `auth@docker` and `task@docker`.
