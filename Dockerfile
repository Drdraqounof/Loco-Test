# Build stage
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Prisma inspects the system SSL libraries when generating its engine bindings.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy package files and Prisma schema first so client generation works during install
COPY package*.json ./
COPY prisma ./prisma

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js app
RUN npx prisma generate && npm run build

# Runtime stage
FROM node:20-bookworm-slim

WORKDIR /app

# Install healthcheck tooling and OpenSSL runtime used by Prisma
RUN apt-get update \
  && apt-get install -y --no-install-recommends wget openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy package files, installed modules, build output, Prisma assets, and startup script
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Run Prisma setup, then start the app
ENTRYPOINT ["./docker-entrypoint.sh"]
