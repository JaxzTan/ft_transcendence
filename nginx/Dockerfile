# TLS reverse proxy / static host.
# Holds NO application code — the SPA arrives at runtime through the
# web_dist volume, written by the frontend build container.
# ═══════════════════════════════════════════════════════════

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
    -subj "/C=MY/ST=Selangor/L=Subang Jaya/O=42KL/OU=Transcendence/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:transcendence-chess,IP:127.0.0.1"

COPY conf/nginx.conf /etc/nginx/nginx.conf
COPY conf/app.inc /etc/nginx/app.inc

# 443 = public HTTPS (localhost + LAN).
# 80  = plain HTTP, published to 127.0.0.1 only, ngrok's upstream.
EXPOSE 443 80

# Run NGINX in foreground (PID 1 compliant)
CMD ["nginx", "-g", "daemon off;"]
