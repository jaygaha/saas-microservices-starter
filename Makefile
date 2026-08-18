COMPOSE = docker compose -f infra/compose.yaml --env-file .env
DEV = docker compose -f infra/compose.yaml -f infra/compose.dev.yaml --env-file .env $(PROFILE)
PROFILE = --profile core
# --- Migrations (golang-migrate, one-shot) ---
MIGRATE = $(COMPOSE) --profile migrate run --rm migrate
MIGRATE_IMAGE = migrate/migrate:v4.19.1
SQLC_IMAGE = sqlc/sqlc:1.29.0
BASE ?= http://localhost:8020

.PHONY: up down build rebuild logs ps restart clean help migrate migrate-down migrate-version migrate-force migrate-create sqlc smoke

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build images and start the whole stack in the background
	$(COMPOSE) $(PROFILE) up -d --build

down: ## Stop and remove containers (KEEPS data volumes)
	$(COMPOSE) down

build: ## Build the service images without starting anything
	$(COMPOSE) $(PROFILE) build

migrate: ## Apply all up migrations
	$(MIGRATE) up
	
migrate-down: ## Roll back the most recent migration
	$(MIGRATE) down 1

migrate-version: ## Show the current schema version
	$(MIGRATE) version
	
migrate-force: ## Clear a 'dirty' state by forcing a version:  make migrate-force V=1
	$(MIGRATE) force $(V)
	
migrate-create: ## Scaffold a migration:  make migrate-create name=create_users
	docker run --rm -v "$(CURDIR)/infra/database/migrations:/migrations" $(MIGRATE_IMAGE) \
			create -ext sql -dir /migrations -seq $(name)

sqlc: ## Generate type-safe Go from SQL (auth-service)
	docker run --rm -v "$(CURDIR):/src" -w /src/auth-service $(SQLC_IMAGE) generate

rebuild: ## Rebuild images from scratch (no layer cache)
	$(COMPOSE) $(PROFILE) build --no-cache

logs: ## Tail logs from all services (Ctrl-C to stop)
	$(COMPOSE) $(PROFILE) logs -f

ps: ## Show container status
	$(COMPOSE) $(PROFILE) ps

smoke: ## Health-check the running stack (gateway + services)
	@echo "smoke: $(BASE)"
	@curl -fsS $(BASE)/api/auth/health/ready >/dev/null && echo "  ✓ auth-service ready"   || { echo "  ✗ auth-service";  exit 1; }
	@curl -fsS $(BASE)/api/tasks/health >/dev/null && echo "  ✓ task-service healthy" || { echo "  ✗ task-service";  exit 1; }
	@echo "smoke: OK"

up-dev: ## Start the stack with the frontend in dev mode (Vite + HMR) at :3000
	$(DEV) up -d --build

down-dev: ## Stop the dev stack
	$(DEV) down

logs-dev: ## Tail the dev frontend logs
	$(DEV) logs -f web-service

restart: down up ## Restart the whole stack

clean: ## Stop containers AND delete volumes (WIPES Postgres/Redis data)
	$(COMPOSE) down -v
