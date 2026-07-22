COMPOSE_FILE   = compose.yaml
SECRET_DIR     = secrets

# Every secret is one value per file, named after the variable it holds in lower
# case: JWT_SECRET -> secrets/jwt_secret.txt. Services bind-mount the directory
# at /secrets and read it there (backend/src/secrets.ts, the db/redis init
# scripts), so nothing sensitive travels through .env or the compose
# environment — no --env-file is passed anywhere below. The remaining ${...} in
# compose.yaml are non-secret and all carry defaults.

# Supplied by the OAuth provider consoles. Can't be generated; the backend calls
# requireSecret() on each of these and throws at boot if one is missing.
OAUTH_SECRETS  = google_client_id google_client_secret google_callback_url \
                 github_client_id github_client_secret github_callback_url \
                 fortytwo_client_id fortytwo_client_secret fortytwo_callback_url

all: check-secrets build start

# Fills in anything generatable or safe to default. Existing files are never
# touched, so local overrides survive.
prepare-secrets:
	@mkdir -p $(SECRET_DIR)
	@set -e; \
	gen()  { [ -s $(SECRET_DIR)/$$1.txt ] || openssl rand -hex $$2 > $(SECRET_DIR)/$$1.txt; }; \
	seed() { [ -s $(SECRET_DIR)/$$1.txt ] || printf '%s\n' "$$2" > $(SECRET_DIR)/$$1.txt; }; \
	gen  jwt_secret        32; \
	gen  db_password       16; \
	gen  db_root_password  16; \
	gen  redis_password    16; \
	seed db_credentials    'db_bossman:transcendence:db'; \
	seed redis_credentials 'redisboss'; \
	seed frontend_url      'https://localhost:8443'; \
	seed database_url \
	  "postgresql://db_bossman:$$(cat $(SECRET_DIR)/db_password.txt)@localhost:5432/transcendence"; \
	chmod 600 $(SECRET_DIR)/*.txt
	@echo "🔑 Secrets ready in $(SECRET_DIR)/ — one value per file, <VAR> lowercased"

# Fails fast here rather than letting the backend crash-loop on a missing secret.
check-secrets: prepare-secrets
	@missing=""; \
	for s in $(OAUTH_SECRETS); do \
	  [ -s $(SECRET_DIR)/$$s.txt ] || missing="$$missing $$s"; \
	done; \
	if [ -n "$$missing" ]; then \
	  echo "❌ Missing OAuth secrets — the backend will throw on startup:"; \
	  for s in $$missing; do echo "      $(SECRET_DIR)/$$s.txt"; done; \
	  echo "   Copy these from the Google / GitHub / 42 developer consoles."; \
	  exit 1; \
	fi; \
	echo "✅ All required secrets present"

build: check-secrets
	@docker compose -f $(COMPOSE_FILE) build

start:
	@docker compose -f $(COMPOSE_FILE) up -d

# Brings up the whole stack plus the Vite HMR server. Both front doors stay
# live: 8080 serves source with hot reload, 8443 serves the built SPA through
# nginx, so the production path can still be checked without tearing anything
# down. The dev profile is off by default, hence --profile here but not in all.
dev: check-secrets
	@docker compose -f $(COMPOSE_FILE) --profile dev up -d --build
	@echo "🔥 HMR dev server:    http://localhost:8080"
	@echo "🔒 nginx (built SPA): https://localhost:8443"

# stop/down/logs carry --profile dev so they still reach frontend-dev; without
# it compose ignores profiled services and leaves the container orphaned.
stop:
	@docker compose -f $(COMPOSE_FILE) --profile dev stop

down:
	@docker compose -f $(COMPOSE_FILE) --profile dev down

logs:
	@docker compose -f $(COMPOSE_FILE) --profile dev logs -f

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
	@docker compose -f $(COMPOSE_FILE) --profile dev stop
	@echo "Stopped."

re: stop down all

.PHONY: all prepare-secrets check-secrets build start dev stop down logs clean fclean prune re tunnel dev-tunnel stop-tunnel
