# S04: Docker + Health Checks

**Goal:** Containerize the FastAPI application and PostgreSQL with Docker Compose, ensuring proper startup ordering and health checks so `docker-compose up` starts everything with working database connectivity.
**Demo:** После этого: docker-compose up запускает всё; GET /health returns 200; localhost:8000/docs открывается

## Must-Haves

- docker-compose up starts both services without errors
- PostgreSQL is ready before FastAPI starts (healthcheck ensures this)
- GET /health returns 200 with db_status: "ok"
- localhost:8000/docs is accessible in browser

## Proof Level

- This slice proves: operational

## Integration Closure

Upstream surfaces consumed: FastAPI application from S03, PostgreSQL schema from S01, SQLAlchemy models from S02. New wiring: Docker Compose orchestration with healthcheck directives. What remains: nothing — milestone M001 end-to-end operational after this slice.

## Verification

- Health check endpoint now reports database connectivity status. Docker Compose healthchecks expose service readiness via `docker-compose ps`. Container logs capture startup errors and database connection issues.

## Tasks

- [x] **T01: Create Dockerfile for FastAPI container** `est:20m`
  ## Why
  Creates a production-ready multi-stage Dockerfile for the FastAPI backend. This enables containerization with minimal image size and proper dependency management.
  - Files: `backend/Dockerfile`
  - Verify: docker build -t zakuppro-api backend/ --progress plain

- [x] **T02: Create docker-compose.yml and .dockerignore** `est:30m`
  ## Why
  Orchestrates PostgreSQL and FastAPI containers with proper health checks and startup ordering. Docker Compose ensures database is ready before API starts, preventing connection errors.
  - Files: `docker-compose.yml`, `.dockerignore`
  - Verify: docker-compose up -d && timeout 60 sh -c 'until docker-compose ps | grep -q healthy; do sleep 2; done'

- [x] **T03: Enhance health check with database connectivity** `est:15m`
  ## Why
  Current /health endpoint only returns {"status": "ok"} without verifying database connection. This change adds real database connectivity check so health failures are visible immediately.
  - Files: `backend/routers/health.py`
  - Verify: curl http://localhost:8000/health | grep -q db_status

## Files Likely Touched

- backend/Dockerfile
- docker-compose.yml
- .dockerignore
- backend/routers/health.py
