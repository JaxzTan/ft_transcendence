#!/bin/sh
set -e

# Validate required secrets exist
echo "🔍 Validating secrets..."
for f in /secrets/db_credentials.txt /secrets/db_password.txt /secrets/chess_engine_credentials.txt; do
  if [ ! -f "$f" ]; then
    echo "FATAL: Missing secret file $f"
    exit 1
  fi
done

# Construct DATABASE_URL from db_credentials and db_password secrets if not already set
if [ -z "$DATABASE_URL" ]; then
  CREDS=$(cat /secrets/db_credentials.txt | tr -d '\n')
  PASSWORD=$(cat /secrets/db_password.txt | tr -d '\n')
  USER=$(echo "$CREDS" | cut -d':' -f1)
  DB=$(echo "$CREDS" | cut -d':' -f2)
  HOST=$(echo "$CREDS" | cut -d':' -f3)

  if [ -z "$HOST" ]; then
    HOST="localhost"
  fi

  export DATABASE_URL="postgresql://${USER}:${PASSWORD}@${HOST}:5432/${DB}"
  echo "DATABASE_URL configured for ${HOST}:5432/${DB}"
fi

# Initialize database schema with Prisma db push
# Note: Not using migrate deploy — this project uses db push (no migration history)
echo "🔧 Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

exec "$@"