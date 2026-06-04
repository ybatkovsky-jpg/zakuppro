---
id: T01
parent: S05
milestone: M005
key_files:
  - Dockerfile
  - .dockerignore
key_decisions: []
duration: 
verification_result: mixed
completed_at: 2026-06-03T12:25:20.808Z
blocker_discovered: false
---

# T01: Created multi-stage Dockerfile for Next.js frontend with node:20-slim, non-root user, and health check

**Created multi-stage Dockerfile for Next.js frontend with node:20-slim, non-root user, and health check**

## What Happened

Created a multi-stage Dockerfile at `D:/CLAUDE/Project/zakuppro/zakuppro/Dockerfile` for the Next.js frontend. The Dockerfile follows the pattern established by the backend Dockerfile:

**Builder Stage (node:20-slim):**
- Sets working directory to /app
- Copies package.json and package-lock.json
- Installs dependencies with npm ci
- Copies application source
- Runs npm run build to create standalone output

**Runtime Stage (node:20-slim):**
- Installs curl for health check
- Creates non-root user 'node' for security
- Copies built artifacts from builder: .next/standalone, public, .next/static
- Sets NODE_ENV=production and FASTAPI_URL=http://api:8000
- Switches to non-root user
- Exposes port 3000
- Adds HEALTHCHECK using curl to localhost:3000
- Runs standalone server.js with CMD

Updated `.dockerignore` to remove the exclusion of Dockerfile (needed for frontend build) and added frontend build artifacts (.next/, out/) to the ignore list.

The Dockerfile is ready for Docker Compose integration and follows security best practices with non-root user execution.

## Verification

Docker verification command (docker build -t zakuppro-frontend -f Dockerfile .) could not be executed due to Docker Desktop not being accessible (500 Internal Server Error on Docker Engine API). The Dockerfile syntax was manually verified:
- All directives (FROM, RUN, COPY, WORKDIR, ENV, USER, EXPOSE, HEALTHCHECK, CMD) are properly formatted
- Multi-stage build structure follows Docker best practices
- Non-root user creation uses proper flags (-r, -g)
- Copy commands use chown for the non-root user
- Health check uses curl with appropriate parameters
- Paths align with Next.js standalone output structure

Once Docker is available, verification can be completed with: docker build -t zakuppro-frontend -f Dockerfile . && docker images | grep zakuppro-frontend

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `docker build -t zakuppro-frontend -f Dockerfile .` | -1 | skipped | 0ms |
| 2 | `cat Dockerfile | grep -E '^(FROM|RUN|COPY|WORKDIR|ENV|USER|EXPOSE|HEALTHCHECK|CMD)'` | 0 | pass | 50ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `Dockerfile`
- `.dockerignore`
