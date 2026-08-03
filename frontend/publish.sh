#!/bin/sh
# Builds the SPA and publishes it into /export (the shared spa_dist volume
# nginx serves from), then watches src/ and republishes on every change
# instead of exiting. Keeps the container alive so it behaves/logs like a
# normal long-running service instead of a one-shot job.
set -e

publish() {
  npm run build
  rm -rf /export/*
  cp -a /app/dist/. /export/
  echo "📦 [$(date '+%H:%M:%S')] SPA published to spa_dist"
}

publish

echo "👀 Watching /app/src for changes..."
while inotifywait -qr -e modify,create,delete,move /app/src; do
  echo "🔄 [$(date '+%H:%M:%S')] Change detected, rebuilding..."
  publish
done
