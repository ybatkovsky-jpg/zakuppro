# Multi-stage Dockerfile for ZakupPro Next.js Frontend
# Stage 1: Builder - installs dependencies and builds Next.js standalone output
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application source
COPY . .

# Build Next.js standalone output
RUN npm run build

# Stage 2: Runtime - minimal image with only built artifacts
FROM node:20-slim

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r node && useradd -r -g node node

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
