#!/bin/sh
set -e

SECRETS_DIR="${SECRETS_DIR:-/secrets}"

# Validate required secrets exist
echo "🔍 Validating secrets..."
for f in "$SECRETS_DIR/db_credentials.txt" "$SECRETS_DIR/db_password.txt" "$SECRETS_DIR/jwt_secret.txt"; do
  if [ ! -f "$f" ]; then
    echo "FATAL: Missing secret file $f"
    exit 1
  fi
done

# DATABASE_URL is assembled here from db_credentials + db_password rather than
# read from database_url.txt, because the two are NOT interchangeable:
# db_credentials carries the compose service hostname ("db"), while
# database_url.txt holds the host-side URL (localhost:5432, via the published
# port) used when running the app outside Docker. Using the latter in here would
# point the container at itself.
if [ -z "$DATABASE_URL" ]; then
  CREDS=$(tr -d '\n' < "$SECRETS_DIR/db_credentials.txt")
  PASSWORD=$(tr -d '\n' < "$SECRETS_DIR/db_password.txt")
  USER=$(echo "$CREDS" | cut -d':' -f1)
  DB=$(echo "$CREDS" | cut -d':' -f2)
  HOST=$(echo "$CREDS" | cut -d':' -f3)

  if [ -z "$HOST" ]; then
    HOST="localhost"
  fi

  export DATABASE_URL="postgresql://${USER}:${PASSWORD}@${HOST}:5432/${DB}"
  echo "DATABASE_URL assembled for ${HOST}:5432/${DB}"
fi

# Initialize database schema with Prisma db push
# Note: Not using migrate deploy — this project uses db push (no migration history)
echo "🔧 Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

exec "$@"