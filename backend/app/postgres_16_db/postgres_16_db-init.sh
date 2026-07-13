#!/bin/sh
# =============================================================================
# postgres_16_db init script
# Inception-style: read secrets, then exec the main process
# =============================================================================

echo "🔧 Configuring PostgreSQL..."

# Read password from secret file
if [ -f "/secrets/db_password.txt" ]; then
  PASSWORD=$(cat /secrets/db_password.txt | tr -d '\n')
  echo "✅ Read password from secret file"
else
  echo "❌ Secret file not found: /secrets/db_password.txt"
  exit 1
fi

# Check that password is not empty
if [ -z "$PASSWORD" ]; then
  echo "❌ Password is empty!"
  exit 1
fi

echo "🔑 Setting POSTGRES_PASSWORD"

# Export the password
export POSTGRES_PASSWORD="$PASSWORD"

# Execute the original postgres entrypoint with the password in environment
exec /usr/local/bin/docker-entrypoint.sh postgres