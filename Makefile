COMPOSE = docker compose -f infra/compose.yaml --env-file .env
PROFILE = --profile core

.PHONY: up down build rebuild logs ps restart clean help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build images and start the whole stack in the background
	$(COMPOSE) $(PROFILE) up -d --build

down: ## Stop and remove containers (KEEPS data volumes)
	$(COMPOSE) down

build: ## Build the service images without starting anything
	$(COMPOSE) $(PROFILE) build

rebuild: ## Rebuild images from scratch (no layer cache)
	$(COMPOSE) $(PROFILE) build --no-cache

logs: ## Tail logs from all services (Ctrl-C to stop)
	$(COMPOSE) $(PROFILE) logs -f

ps: ## Show container status
	$(COMPOSE) $(PROFILE) ps

restart: down up ## Restart the whole stack

clean: ## Stop containers AND delete volumes (WIPES Postgres/Redis data)
	$(COMPOSE) down -v
