#!/bin/sh

# In plain terms: this script is the app's startup checklist inside Docker.
# It prepares Prisma and then starts the app server.

set -eu

echo "[docker-entrypoint] Generating Prisma client..."
npx prisma generate

echo "[docker-entrypoint] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[docker-entrypoint] Starting Next.js..."
exec npm start