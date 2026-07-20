# Frontend build container.
# Compiles the React SPA, publishes dist/ into the shared web_dist volume,
# then EXITS. There is no frontend process at runtime — nginx serves the
# files. compose gates nginx on this container finishing successfully.
# ═══════════════════════════════════════════════════════════

# Stage 1: Build React SPA
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# ci, not install: install re-resolves the tree and can silently pull newer
# transitive versions than package-lock.json pins, so the image drifts with
# no source change. ci installs the lockfile exactly, or fails loudly if the
# lockfile and package.json disagree.
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Tiny publisher — carries the built assets and nothing else
FROM alpine:3
COPY --from=builder /app/dist /app/dist

# Wipe before copying: a plain overwrite would leave files from a previous
# build that no longer exist in dist/ (renamed chunks, deleted pages) lying
# in the volume for nginx to keep serving. -mindepth 1 also catches dotfiles.
CMD ["sh", "-c", "set -e; \
    find /dist-out -mindepth 1 -delete; \
    cp -a /app/dist/. /dist-out/; \
    echo '✅ SPA published to web_dist volume'"]
