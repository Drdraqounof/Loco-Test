#!/bin/sh

set -eu

echo "[docker-entrypoint] Generating Prisma client..."
npx prisma generate

echo "[docker-entrypoint] Applying Prisma migrations..."
npx prisma migrate deploy

echo "[docker-entrypoint] Starting Next.js..."
exec npm start