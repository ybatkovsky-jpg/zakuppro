# S05: Production Readiness Polish

**Goal:** Make the ZakupPro application production-ready by ensuring it runs properly in Docker Compose with all services healthy and a basic smoke test validates the core create → update → delete workflow.
**Demo:** Приложение запускается в Docker Compose. Frontend на порту 3000, backend на 8000. Все healthchecks green. Smoke test проходит: создать проект → обновить статус → удалить.

## Must-Haves

- Frontend Docker service builds and runs successfully on port 3000
- All 7 Docker Compose services show healthy status
- Database migrations run automatically on container startup
- Smoke test script validates create → update → delete workflow
- README.md documents Docker Compose startup and smoke test

## Proof Level

- This slice proves: operational

## Integration Closure

Completes M005 milestone by integrating all previous slices into a production-ready Docker Compose stack. The smoke test validates the full API contract from S01-S04 working end-to-end.

## Verification

- Health endpoints provide structured status for all services. Smoke test provides automated verification of core workflows. Docker Compose health checks expose service availability.

## Tasks

- [x] **T01: Frontend Dockerfile** `est:30m`
  Create a multi-stage Dockerfile for the Next.js frontend that builds the standalone output and runs it in production. This enables the frontend to run as a Docker service alongside the backend.
  - Files: `Dockerfile`, `.dockerignore`
  - Verify: docker build -t zakuppro-frontend -f Dockerfile . && docker images | grep zakuppro-frontend

- [x] **T02: Frontend Service in docker-compose.yml** `est:15m`
  Add the frontend service to docker-compose.yml with proper dependencies, environment variables, and health check.
  - Files: `docker-compose.yml`
  - Verify: docker-compose config | grep -A 20 'frontend'

- [x] **T03: Missing Healthchecks for celery-worker and telegram-bot** `est:15m`
  Add healthchecks to celery-worker and telegram-bot services that currently lack them.
  - Files: `docker-compose.yml`
  - Verify: grep -A 5 'celery-worker:' docker-compose.yml | grep healthcheck && grep -A 5 'telegram-bot:' docker-compose.yml | grep healthcheck

- [x] **T04: Database Migration on Backend Startup** `est:20m`
  Ensure Alembic migrations run automatically when the backend container starts.
  - Files: `backend/Dockerfile`, `backend/entrypoint.sh`
  - Verify: grep -q 'alembic upgrade head' backend/Dockerfile && grep -q 'uvicorn' backend/Dockerfile

- [x] **T05: Smoke Test Script** `est:30m`
  Create an automated smoke test script that validates the core create → update → delete workflow.
  - Files: `scripts/smoke-test.sh`
  - Verify: bash scripts/smoke-test.sh && echo 'Exit code: $?'

- [x] **T06: README.md Documentation** `est:15m`
  Update README.md with Docker Compose startup instructions and smoke test documentation.
  - Files: `README.md`
  - Verify: grep -q 'docker-compose up' README.md && grep -q 'smoke-test' README.md

- [x] **T07: Full Docker Compose Verification** `est:30m`
  Verify the complete Docker Compose stack starts correctly and all services become healthy.
  - Verify: docker-compose ps | grep -c 'healthy' | xargs -I {} test {} -eq 7 && bash scripts/smoke-test.sh

## Files Likely Touched

- Dockerfile
- .dockerignore
- docker-compose.yml
- backend/Dockerfile
- backend/entrypoint.sh
- scripts/smoke-test.sh
- README.md
