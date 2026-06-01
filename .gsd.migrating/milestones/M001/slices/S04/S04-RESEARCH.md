# Research: Docker + Health Checks (S04)

## Summary

This slice needs to containerize the ZakupPro FastAPI application and PostgreSQL database with Docker Compose, ensuring proper startup ordering and health checks. The goal is `docker-compose up` to start everything with `GET /health` returning 200 and `localhost:8000/docs` accessible.

**Current State:** No Docker configuration exists in the project. The backend is a FastAPI application with 10 routers, PostgreSQL database via SQLAlchemy 2.0, and Alembic migrations. Health check endpoint exists at `/health` but returns `{"status": "ok"}` without database connectivity verification.

**Gap:** Need Dockerfile for FastAPI container, docker-compose.yml for orchestration, and enhanced health check with database connectivity.

## Recommendation

**Approach:** Multi-stage Dockerfile with Python 3.11-slim, Docker Compose v3.8+ with healthcheck directives, and PostgreSQL native `pg_isready` for dependency management.

**Key Decisions:**
- Use uvicorn[standard] for production ASGI server (includes uvloop for performance)
- Multi-stage build to keep final image minimal
- Docker Compose v3 `healthcheck` directive for both services
- depends_on with `condition: service_healthy` for startup ordering
- Volume mounts for hot-reload in development
- Network isolation via dedicated bridge network

**Rationale:** This pattern ensures PostgreSQL is fully ready before FastAPI starts, prevents connection errors, and provides proper container orchestration with health monitoring. The health check endpoint needs database connectivity verification to catch connection issues early.

## Implementation Landscape

### Key Files

| File Path | Purpose |
|-----------|---------|
| `backend/Dockerfile` | Multi-stage build for FastAPI container |
| `docker-compose.yml` | Orchestration with health checks and dependencies |
| `backend/routers/health.py` | **Modify** - add database connectivity check |
| `.dockerignore` | Exclude unnecessary files from build context |
| `.env` | Already exists - DATABASE_URL will be used in containers |

### Build Order

1. **backend/Dockerfile** - Create multi-stage build
   - Stage 1: builder - install dependencies from requirements.txt
   - Stage 2: final - copy installed packages, add non-root user
   - CMD: uvicorn backend.main:app --host 0.0.0.0 --port 8000

2. **docker-compose.yml** - Define services
   - Service `db`: PostgreSQL 15-alpine with pg_isready healthcheck
   - Service `api`: FastAPI with app healthcheck, depends_on db with condition: service_healthy
   - Shared network `zakuppro-network`
   - Volume `db-data` for persistence
   - Volume mount for ./backend to app code (development hot-reload)

3. **backend/routers/health.py** - Enhance health check
   - Add database session dependency injection
   - Execute simple query (SELECT 1) to verify connectivity
   - Return 200 with db_status: "ok" or db_status: "error"

4. **.dockerignore** - Optimize build context
   - Exclude __pycache__, .git, .pytest_cache, *.db
   - Include alembic/ for migrations

### Verification Approach

1. **Build phase:**
   - `docker-compose build` - both images build without errors
   - No warnings in build output

2. **Startup phase:**
   - `docker-compose up -d` - containers start
   - `docker-compose ps` - both services show "healthy" status
   - `docker-compose logs api` - no connection errors, uvicorn listening

3. **Health check phase:**
   - `curl http://localhost:8000/health` - returns 200 with `{"status": "ok", "db_status": "ok"}`
   - `curl http://localhost:8000/docs` - returns 200 with Swagger UI HTML
   - Browser to http://localhost:8000/docs - interactive docs load correctly

4. **Integration phase:**
   - `docker-compose exec api alembic upgrade head` - migrations run successfully
   - `docker-compose exec api pytest` - all tests pass against containerized database

## Additional Considerations

- **Production vs Development:** Current setup is for development (volume mounts, echo=True). Production would need separate compose file without hot-reload.
- **Migration Automation:** Consider adding migration command to entrypoint or separate init container for production.
- **Secrets Management:** DATABASE_URL exposed in compose file for development - use Docker secrets in production.
- **Resource Limits:** Add mem_limit to api service in production to prevent runaway processes.