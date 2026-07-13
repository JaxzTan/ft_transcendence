COMPOSE_FILE   = compose.yaml
COMPOSE_ENV    = --env-file .env
SECRET_DIR     = secrets
JWT_SECRET     = $(SECRET_DIR)/chess_engine_credentials.txt
DB_PASSWORD    = $(SECRET_DIR)/db_password.txt

all: prepare-secrets build start

prepare-secrets:
	@mkdir -p $(SECRET_DIR)
	@if [ ! -f $(JWT_SECRET) ]; then openssl rand -hex 32 > $(JWT_SECRET); fi
	@if [ ! -f $(DB_PASSWORD) ]; then openssl rand -hex 16 > $(DB_PASSWORD); fi
	@chmod 600 $(DB_PASSWORD) $(JWT_SECRET)
	@if [ ! -f secrets/db_credentials.txt ]; then echo "db_bossman:transcendence:db" > secrets/db_credentials.txt; fi
	@echo "🔑 Secrets prepared: db_password, chess_engine_credentials, db_credentials"

build: prepare-secrets
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) build

start:
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) up -d

dev: build
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) watch

stop:
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) stop

down:
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) down

logs:
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) logs -f

clean:
	@echo "🗑️  Cleaning all Docker data..."
	@docker stop $$(docker ps -qa) 2>/dev/null; \
	docker rm $$(docker ps -qa) 2>/dev/null; \
	docker rmi -f $$(docker images -qa) 2>/dev/null; \
	docker volume rm $$(docker volume ls -q) 2>/dev/null; \
	docker network rm $$(docker network ls -q) 2>/dev/null; \
	echo "✅  Done."

fclean: prune clean

prune:
	@docker system prune -af --volumes

tunnel:
	@ngrok http https://localhost:8443 --host-header=localhost

dev-tunnel:
	@osascript -e 'tell application "Terminal" to do script "cd $(PWD) && make dev"'
	@osascript -e 'tell application "Terminal" to do script "cd $(PWD) && make tunnel"'

stop-tunnel:
	@pkill -f ngrok 2>/dev/null || true
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) stop
	@echo "Stopped."

re: stop down all

.PHONY: all build start dev stop down logs clean fclean prune re tunnel dev-tunnel stop-tunnel
