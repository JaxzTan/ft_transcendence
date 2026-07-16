# Unified Frontend Dockerfile: React build + TLS nginx
# ═══════════════════════════════════════════════════════════

# Stage 1: Build React SPA
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: TLS nginx server with self-signed certificates
FROM debian:bookworm

# Install nginx with modules + OpenSSL for TLS
RUN apt-get update && apt-get install -y \
    nginx-extras \
    netcat-openbsd \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create secure vault directory for TLS keys
RUN mkdir -p /etc/nginx/ssl

# Generate Self-Signed TLS certificates (v1.2/v1.3)
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/transcendence.key \
    -out /etc/nginx/ssl/transcendence.crt \
    -subj "/C=MY/ST=Selangor/L=Subang Jaya/O=42KL/OU=Transcendence/CN=transcendence-ludo"

# Copy nginx configuration and built React app
COPY src/nginx/conf/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# Open ONLY port 443 (HTTPS) to the public
EXPOSE 443

# Run NGINX in foreground (PID 1 compliant)
CMD ["nginx", "-g", "daemon off;"]