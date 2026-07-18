COMPOSE_FILE   = compose.yaml
COMPOSE_ENV    = --env-file .env
SECRET_DIR     = secrets
JWT_SECRET     = $(SECRET_DIR)/chess_engine_credentials.txt
DB_PASSWORD    = $(SECRET_DIR)/db_password.txt

# --- Networking -------------------------------------------------------------
# Config values live in .env; everything below is DERIVED from them.
# Tolerates "KEY=v", "KEY = v" and quoted values — a strict ^KEY= match
# silently yields an empty string the moment someone adds a space.
env_get = $(shell sed -n 's/^[[:space:]]*$(1)[[:space:]]*=[[:space:]]*//p' .env 2>/dev/null | tail -1 | tr -d "\"' \r")

# := so the sed runs once per make invocation, not on every reference.
# The 8080 fallback stops a missing .env key from producing a portless
# `ngrok http` that fails with a useless error.
NGROK_PORT    := $(or $(call env_get,NGROK_PORT),8080)
NGROK_DOMAIN  := $(call env_get,NGROK_DOMAIN)
# Host-side HTTPS port; see compose.yaml for why this isn't a bare 443.
HTTPS_PORT    := $(or $(call env_get,HTTPS_PORT),8443)
NGROK_FLAGS    = $(if $(NGROK_DOMAIN),--url=https://$(NGROK_DOMAIN),)
# .env wins if it sets LAN_IP; otherwise detect from the live interface.
# It can't be a plain .env value because compose's dotenv parser never runs a
# shell — it would store "$(ipconfig ...)" as literal text — so the detection
# has to happen here. Leaving it empty in .env is the right default on a
# laptop that roams between networks.
# Linux: ask the routing table which src IP reaches the internet (works
# regardless of interface name — enp4s0f0, eth0, wlan0, …). macOS: ipconfig
# doesn't exist there, so try the common Wi-Fi/Ethernet interface names.
LAN_IP        := $(or $(call env_get,LAN_IP),$(shell ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p'),$(shell ipconfig getifaddr en0 2>/dev/null),$(shell ipconfig getifaddr en1 2>/dev/null))

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
	@token=$$(sed -n 's/^NGROK=//p' .env 2>/dev/null | tail -1 | tr -d '"'\'' \r'); \
	if [ -z "$$token" ]; then echo "❌  NGROK=<authtoken> missing from .env"; exit 1; fi; \
	ngrok config add-authtoken "$$token" >/dev/null && echo "🔑  ngrok authtoken configured"

# Tunnels the plain-HTTP listener (127.0.0.1:8080), NOT :443 — ngrok would
# reject our self-signed upstream cert. ngrok terminates real TLS publicly,
# so the browser still gets https:// and wss://.
tunnel: ngrok-auth
	@echo "🚇  Tunnelling 127.0.0.1:$(NGROK_PORT) … (URL also shown by: make tunnel-url)"
	@ngrok http $(NGROK_PORT) $(NGROK_FLAGS)

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
	@docker compose -f $(COMPOSE_FILE) $(COMPOSE_ENV) stop
	@echo "Stopped."

re: stop down all

.PHONY: all build start dev stop down logs clean fclean prune re \
        lan ngrok-auth tunnel tunnel-url up-tunnel dev-tunnel stop-tunnel
