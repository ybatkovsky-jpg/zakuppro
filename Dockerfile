# Multi-stage Dockerfile for ZakupPro Next.js Frontend
# Stage 1: Builder - installs dependencies and builds Next.js standalone output
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Prisma needs DATABASE_URL at generate time (it only reads the provider, not the actual DB)
ARG DATABASE_URL=postgresql://postgres:postgres@db:5432/zakuppro
ENV DATABASE_URL=$DATABASE_URL

# Copy package files first (for better Docker layer caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application source (prisma schema, src, etc.)
COPY . .

# Generate Prisma client (required before build)
RUN npx prisma generate

# Build Next.js standalone output
RUN npm run build

# Stage 2: Runtime - minimal image with only built artifacts
FROM node:20-slim

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security (idempotent — skip if 'node' already exists)
RUN id node 2>/dev/null || (groupadd -r node && useradd -r -g node node)

# Set working directory
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Set environment variables
ENV NODE_ENV=production \
    FASTAPI_URL=http://api:8000

# Switch to non-root user
USER node

# Expose frontend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Run standalone server
CMD ["node", "server.js"]
