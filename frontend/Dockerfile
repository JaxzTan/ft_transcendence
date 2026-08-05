# Frontend Dockerfile: builds the React SPA and publishes it.
# Serving is the nginx service's job (see ../nginx). This container stays
# alive: it publishes the build into the shared spa_dist volume, then watches
# src/ and republishes on change, logging like a normal long-running service.
# nginx waits for the healthcheck (first publish) before starting.
# ═══════════════════════════════════════════════════════════

FROM node:22-alpine
RUN apk add --no-cache inotify-tools
WORKDIR /app
COPY package*.json ./
# ci, not install: install re-resolves the tree and can silently pull newer
# transitive versions than package-lock.json pins, so the image drifts with
# no source change. ci installs the lockfile exactly, or fails loudly if the
# lockfile and package.json disagree.
RUN install
COPY . .
RUN chmod +x publish.sh

# /export is where compose mounts spa_dist. Publishing on start (rather than
# baking into the serving image) is what lets the SPA rebuild without touching
# nginx. The wildcard delete keeps stale assets from a previous build out.
# Invoked via `sh` explicitly: node's docker-entrypoint.sh falls back to
# `node ./publish.sh` (and fails on the ESM loader) when it can't resolve the
# command via `command -v`, which a bare "./publish.sh" CMD hits.
CMD ["sh", "publish.sh"]
