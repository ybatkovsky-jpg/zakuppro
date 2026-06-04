---
estimated_steps: 18
estimated_files: 2
skills_used: []
---

# T01: Frontend Dockerfile

Create a multi-stage Dockerfile for the Next.js frontend that builds the standalone output and runs it in production. This enables the frontend to run as a Docker service alongside the backend.

**Why:** Frontend cannot run in Docker Compose without a Dockerfile. Next.js standalone build is already configured, we need to containerize it.

**Do:**
1. Create Dockerfile in project root with multi-stage build:
   - Stage 1 (builder): Use node:20-slim, copy package.json, install dependencies with npm ci, run npm run build
   - Stage 2 (runtime): Use node:20-slim, copy .next/standalone and public, set NODE_ENV=production
2. Add non-root user (node) for security
3. Expose port 3000
4. Add HEALTHCHECK using curl to localhost:3000
5. Set working directory to /app
6. CMD runs standalone server.js

**Constraints:**
- Use node:20-slim (not alpine) for compatibility
- Copy only .next/standalone, public, and node_modules from builder
- Don't copy .next/static (already bundled in standalone)
- Use EXPOSE 3000
- Set FASTAPI_URL=http://api:8000 environment variable

**Done when:** Dockerfile exists at root and `docker build -t zakuppro-frontend .` succeeds

## Inputs

- `next.config.ts`
- `package.json`

## Expected Output

- `Dockerfile`
- `.dockerignore`

## Verification

docker build -t zakuppro-frontend -f Dockerfile . && docker images | grep zakuppro-frontend

## Observability Impact

Health check exposes frontend availability. Container logs show startup errors.
