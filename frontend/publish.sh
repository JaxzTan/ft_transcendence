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

# node_modules lives in an anonymous volume (see compose.yaml) so the bind
# mount doesn't shadow it, but that means it only reflects package.json as of
# whenever the volume was last populated. Installing on every start keeps it
# in sync with the current lockfile instead of silently going stale.
npm install
publish

echo "👀 Watching /app/src and package.json for changes..."
while inotifywait -qr -e modify,create,delete,move \
  /app/src /app/package.json /app/package-lock.json; do
  echo "🔄 [$(date '+%H:%M:%S')] Change detected, rebuilding..."
  # `set -e` would otherwise kill this whole script (and the container) on a
  # single broken save, silently ending the watch loop until someone notices
  # and restarts it. Catch the failure so the next save gets a fresh attempt.
  (npm install && publish) || echo "❌ [$(date '+%H:%M:%S')] Build failed — fix the error and save again."
done
