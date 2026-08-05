#!/bin/sh
# =============================================================================
# redis init script
# Inception-style: read secrets, then exec the main process
# =============================================================================

echo "🔧 Configuring Redis..."

# Read credentials from secret files
REDIS_USER="default"
if [ -f "/secrets/redis_credentials.txt" ]; then
  REDIS_USER=$(cat /secrets/redis_credentials.txt | tr -d '\n')
  echo "✅ Read Redis username: ${REDIS_USER}"
fi

if [ -f "/secrets/redis_password.txt" ]; then
  REDIS_PASS=$(cat /secrets/redis_password.txt | tr -d '\n')
  echo "✅ Read Redis password from /secrets/redis_password.txt"
  
  # Create Redis config with ACL
  cat > /tmp/redis.conf <<EOF
bind 0.0.0.0
port 6379
timeout 0
save 900 1
save 300 10
save 60 10000
rdbcompression yes
dbfilename dump.rdb
dir /data
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF
  
  echo "🚀 Starting Redis with authentication..."
  
  # Use requirepass instead of ACL (simpler, works in Redis 7)
  exec redis-server --requirepass "${REDIS_PASS}" "$@"
else
  echo "⚠️  No Redis password found, starting without auth (NOT recommended for production)"
  exec redis-server "$@"
fi