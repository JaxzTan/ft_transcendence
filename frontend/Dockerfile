# Frontend Dockerfile: builds the React SPA and nothing else.
# Serving is the nginx service's job (see ../nginx). This container runs as a
# one-shot job: it copies the build output into the shared spa_dist volume and
# exits, and nginx waits for that to complete before starting.
# ═══════════════════════════════════════════════════════════

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# /export is where compose mounts spa_dist. Publishing on start (rather than
# baking into the serving image) is what lets the SPA rebuild without touching
# nginx. The wildcard delete keeps stale assets from a previous build out.
CMD ["sh", "-c", "rm -rf /export/* && cp -a /app/dist/. /export/ && echo '📦 SPA published to spa_dist'"]
