# Multi-stage build for TaDashboard.
# Produces a Next.js standalone bundle that runs under node:20-alpine.

# ---------- Dependencies ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json bun.lock* ./
RUN \
  if [ -f bun.lock ]; then \
    npm ci --no-audit --no-fund; \
  else \
    echo "Lockfile not found." && exit 1; \
  fi

# ---------- Build ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY package.json ./
COPY next.config.ts ./
COPY tsconfig.json ./
COPY postcss.config.mjs ./
COPY components.json ./
COPY public ./public
COPY src ./src

RUN npx prisma generate && \
    npm run build

# ---------- Runtime ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Standalone bundle
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public            ./public

# Local SQLite directory (mounted as PVC in k3s or Docker volume)
RUN mkdir -p /app/db && chown -R nextjs:nodejs /app/db

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/ || exit 1

CMD ["node", "server.js"]