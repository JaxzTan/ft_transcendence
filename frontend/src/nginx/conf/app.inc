# ═══════════════════════════════════════════════════════════
# Shared server body — included by BOTH the :443 TLS listener
# (local + LAN) and the :80 plain listener (ngrok upstream).
# Kept in one file so the two can never drift apart.
# ═══════════════════════════════════════════════════════════

# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;" always;

# Root directory of the React SPA static files
root /usr/share/nginx/html;
index index.html;

# ═══════════════════════════════════════════════════════
# SPA ROUTING — all non-file requests serve index.html
# so React Router handles the frontend navigation
# ═══════════════════════════════════════════════════════
location / {
    try_files $uri $uri/ /index.html;
}

# ═══════════════════════════════════════════════════════
# API PROXY — forwards /api/* requests to backend (Next.js)
# Carries the WebSocket upgrade so wss:// works on the same
# origin as the page, in every mode (local / LAN / ngrok).
# ═══════════════════════════════════════════════════════
location /api/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    # Hardcoded, not $scheme: the client-facing scheme is https in every
    # mode (:443 direct, or ngrok-terminated TLS in front of the :80 hop).
    proxy_set_header X-Forwarded-Proto https;
    # Long-lived sockets: don't cut idle connections at the default 60s
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}

# Deny access to hidden files (e.g. .htaccess, .git, .env)
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
}