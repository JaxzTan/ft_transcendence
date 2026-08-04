COMPOSE_FILE   = compose.yaml
SECRET_DIR     = secrets
JWT_SECRET     = $(SECRET_DIR)/ludo_engine_credentials.txt
DB_PASSWORD    = $(SECRET_DIR)/db_password.txt

# Config values live in $(SECRET_DIR); everything below is DERIVED from them.
# Nothing sensitive or config-y comes from .env any more.
secret_get = $(shell cat $(SECRET_DIR)/$(1).txt 2>/dev/null | tr -d "\"' \r")

# := so the cat runs once per make invocation, not on every reference.
# The 8080 fallback stops a missing secret file from producing a portless
# `ngrok http` that fails with a useless error.
NGROK_PORT    := $(or $(call secret_get,ngrok_port),8443)
NGROK_DOMAIN  := $(call secret_get,ngrok_domain)
# Host-side HTTPS port; see compose.yaml for why this isn't a bare 443.
HTTPS_PORT    := $(or $(call secret_get,https_port),8443)
NGROK_FLAGS    = $(if $(NGROK_DOMAIN),--url=https://$(NGROK_DOMAIN),)
# secrets/lan_ip.txt wins if set; otherwise detect from the live interface.
# It can't be a plain secret value because compose's dotenv parser never runs
# a shell — it would store "$(ipconfig ...)" as literal text — so the
# detection has to happen here. Leaving lan_ip.txt empty is the right default
# on a laptop that roams between networks.
# Linux: ask the routing table which src IP reaches the internet (works
# regardless of interface name — enp4s0f0, eth0, wlan0, …). macOS: ipconfig
# doesn't exist there, so try the common Wi-Fi/Ethernet interface names.
LAN_IP        := $(or $(call secret_get,lan_ip),$(shell ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p'),$(shell ipconfig getifaddr en0 2>/dev/null),$(shell ipconfig getifaddr en1 2>/dev/null))

l: prepare-secrets build startal

OAUTH_SECRETS  = google_client_id google_client_secret google_callback_url \
                 github_client_id github_client_secret github_callback_url \
                 fortytwo_client_id fortytwo_client_secret fortytwo_callback_url

all: check-secrets build start

prepare-secrets:
	@mkdir -p $(SECRET_DIR)
	@set -e; \
	gen()  { [ -s $(SECRET_DIR)/$$1.txt ] || openssl rand -hex $$2 > $(SECRET_DIR)/$$1.txt; }; \
	seed() { [ -s $(SECRET_DIR)/$$1.txt ] || printf '%s\n' "$$2" > $(SECRET_DIR)/$$1.txt; }; \
	gen  jwt_secret        32; \
	gen  db_password       16; \
	gen  db_root_password  16; \
	gen  redis_password    16; \
	gen  engine_api_key    32; \
	seed db_credentials    'db_bossman:transcendence:db'; \
	seed redis_credentials 'redisboss'; \
	seed frontend_url      'https://localhost:8443'; \
	seed ngrok_port        '8080'; \
	seed https_port        '8443'; \
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

# Brings up the whole stack plus the Vite HMR server, then stays attached in
# watch mode: `compose watch` builds+starts everything first (like `up -d
# --build`), then rebuilds/restarts backend and ludo-engine on source changes
# per their `develop.watch` rules in compose.yaml (frontend-dev already
# hot-reloads on its own via Vite + bind mount, so it has none). Both front
# doors stay live: 8080 serves source with hot reload, 8443 serves the built
# SPA through nginx, so the production path can still be checked without
# tearing anything down. The dev profile is off by default, hence --profile
# here but not in all. Ctrl-C stops watching; the containers keep running
# (use `make stop`/`make down`).
dev: check-secrets
	@echo "🔥 HMR dev server:    http://localhost:8080"
	@echo "🔒 nginx (built SPA): https://localhost:8443"
	@docker compose -f $(COMPOSE_FILE) --profile dev watch

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

# ── LAN MODE ────────────────────────────────────────────────────────────────
# Same WiFi. No env changes needed: nginx single-origins /api, so relative
# paths resolve against whatever host the client typed.
lan: all
	@if [ -z "$(LAN_IP)" ]; then echo "❌  No LAN IP on en0/en1 — are you on WiFi?"; exit 1; fi
	@echo ""
	@echo "🌐  LAN mode up.  Other devices on this WiFi:"
	@echo "      https://$(LAN_IP):$(HTTPS_PORT)"
	@echo ""
	@echo "    Self-signed cert → tap through the browser warning once."
	@echo "    Nothing shows up? Campus/corporate WiFi client isolation blocks"
	@echo "    device-to-device traffic — use a phone hotspot to test."

# ── NGROK MODE ──────────────────────────────────────────────────────────────
ngrok-auth:
	@token=$$(cat $(SECRET_DIR)/ngrok.txt 2>/dev/null | tr -d '"'\'' \r'); \
	if [ -z "$$token" ]; then echo "❌  ngrok authtoken missing — put it in $(SECRET_DIR)/ngrok.txt"; exit 1; fi; \
	ngrok config add-authtoken "$$token" >/dev/null && echo "🔑  ngrok authtoken configured"

# Tunnels nginx's TLS listener (127.0.0.1:8443) — the address is given as
# https:// so ngrok speaks TLS to the local backend instead of forwarding
# plain HTTP at it. ngrok doesn't verify the upstream cert by default (that's
# opt-in via --upstream-tls-verify), so the self-signed cert isn't a problem.
tunnel: all ngrok-auth
	@echo "🔀  Switching backend into tunnel mode (ngrok OAuth apps)…"
	@TUNNEL_MODE=true docker compose -f $(COMPOSE_FILE) up -d --no-deps backend
	@echo "🚇  Tunnelling https://127.0.0.1:$(NGROK_PORT) … (URL also shown by: make tunnel-url)"
	@ngrok http https://localhost:$(NGROK_PORT) $(NGROK_FLAGS)

# Public URL of a tunnel that's already running, from ngrok's local API.
tunnel-url:
	@curl -s http://127.0.0.1:4040/api/tunnels \
		| grep -o 'https://[^"]*\.ngrok[^"]*' | head -1 \
		|| echo "No tunnel running — start one with: make tunnel"

# One command: build + start the stack (detached), then open the public tunnel.
# Stack runs in the background; ngrok stays in the foreground (Ctrl-C stops the
# tunnel, containers keep running — use `make stop-tunnel` to stop everything).
tunnel_up: all tunnel

dev-tunnel:
	@osascript -e 'tell application "Terminal" to do script "cd $(PWD) && make dev"'
	@osascript -e 'tell application "Terminal" to do script "cd $(PWD) && make tunnel"'

stop-tunnel:
	@pkill -f ngrok 2>/dev/null || true
	@docker compose -f $(COMPOSE_FILE) --profile dev stop
	@echo "Stopped."

re: stop down all

.PHONY: all build start dev stop down logs clean fclean prune re \
        lan ngrok-auth tunnel tunnel-url up-tunnel dev-tunnel stop-tunnel
