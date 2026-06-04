# Slice S05 Research: Production Readiness Polish

## Overview

Slice S05 focuses on making the ZakupPro application production-ready by ensuring it runs properly in Docker Compose with all services healthy and a basic smoke test validates the core create → update → delete workflow.

## Current State Analysis

### Existing Docker Infrastructure

**docker-compose.yml** exists with 6 services defined:
1. **db** - PostgreSQL 15-alpine with healthcheck
2. **api** - FastAPI backend with healthcheck
3. **rabbitmq** - RabbitMQ 3-management with healthcheck
4. **email-worker** - IMAP email polling with healthcheck
5. **celery-worker** - Celery task worker (no healthcheck)
6. **telegram-bot** - Telegram bot service (no healthcheck)

### Health Check Status

| Service | Healthcheck | Status |
|---------|-------------|--------|
| db (PostgreSQL) | ✅ pg_isready | Implemented |
| api (FastAPI) | ✅ /health endpoint | Implemented |
| rabbitmq | ✅ rabbitmq-diagnostics | Implemented |
| email-worker | ✅ ps aux grep | Implemented |
| celery-worker | ❌ None | Missing |
| telegram-bot | ❌ None | Missing |
| frontend | ❌ Not in compose | Missing |

### Backend Health Endpoint

`backend/routers/health.py` already exists and checks:
- Database connectivity (SELECT 1)
- RabbitMQ connection via Celery broker
- Celery worker availability via inspect.ping()

Returns 200 when all OK, 503 with detailed status when degraded.

### Frontend Status

**Next.js Configuration:**
- `next.config.ts` has `output: "standalone"` enabled
- Build script: `next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/`
- Start script: `NODE_ENV=production bun .next/standalone/server.js`
- Port: 3000 (from package.json `dev` script)

**Frontend Docker:**
- No Dockerfile exists
- No service in docker-compose.yml
- Standalone build already exists at `.next/standalone/`

**Environment Variables:**
- `FASTAPI_URL=http://localhost:8000` (needs `http://api:8000` in Docker network)
- No other critical env vars for frontend (uses server-side API routes)

### Dependencies

**Backend dependencies (requirements.txt):**
- FastAPI 0.115.0, Uvicorn 0.32.0
- SQLAlchemy 2.0.35, Alembic 1.13.3
- Celery 5.4.0, python-jose, passlib
- All required packages present

**Frontend dependencies (package.json):**
- Next.js 16.1.1, React 19, TypeScript 5
- @dnd-kit, TanStack Query, Recharts
- All UI dependencies present

## Missing Components for S05

### 1. Frontend Dockerfile

No frontend Dockerfile exists. Needs to be created for:
- Multi-stage build (builder → runtime)
- Copy standalone Next.js output
- Set NODE_ENV=production
- Expose port 3000
- Run standalone server.js

**Pattern to follow:** Backend multi-stage Dockerfile with:
- Node.js base image (not Alpine, for compatibility)
- Copy `.next/standalone` directory
- Use non-root user
- Healthcheck on port 3000

### 2. Frontend Service in docker-compose.yml

Service definition needs:
- Build from root Dockerfile
- Environment variable `FASTAPI_URL=http://api:8000`
- Depends on `api` service
- Healthcheck for frontend
- Port mapping `3000:3000`

### 3. Celery Worker Healthcheck

Currently missing. Options:
- Use Celery's `inspect.ping()` (same as backend health endpoint)
- Or create a dedicated `/health/celery` endpoint
- Docker healthcheck needs `celery` CLI available in container

**Constraint:** The celery-worker container doesn't have curl/urllib for HTTP checks. Must use `celery` CLI.

### 4. Telegram Bot Healthcheck

Currently missing. Options:
- Check process is running (`ps aux | grep telegram_bot`)
- Create a lightweight `/health` endpoint in bot that responds to ping
- Or use Celery connection check (bot connects to RabbitMQ)

### 5. Smoke Test Script

No automated smoke test exists. Needs to validate:
1. Create project via API → verify in database
2. Update project status → verify change
3. Delete project → verify removal

**Implementation options:**
- Bash script with curl commands
- Python script using requests/FastAPI TestClient
- Add to backend/tests as `test_smoke_e2e.py`

## Integration Points

### API Proxy Pattern

Frontend → Next.js API routes → FastAPI backend

**Critical configuration:**
- In Docker: `FASTAPI_URL=http://api:8000` (Docker network hostname)
- Locally: `FASTAPI_URL=http://localhost:8000`
- All Next.js API routes already use this pattern (from S01)

### Database Migrations

Alembic migrations need to run on startup:
- Current: Manual `alembic upgrade head`
- Production: Should run automatically on container start
- Backend Dockerfile doesn't include migration command

### CORS Configuration

`backend/main.py` has CORS configured for:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`

**Missing:** `http://frontend:3000` for Docker network (if using hostname)
**Note:** In Docker Compose, frontend and api communicate via internal network, not exposed ports

## Implementation Landscape

### Task Breakdown (Recommendation)

**T01: Frontend Dockerfile**
- Create `Dockerfile` in project root
- Multi-stage: build → standalone runtime
- Copy `.next/standalone`, `public`
- Set FASTAPI_URL environment variable
- Healthcheck on port 3000

**T02: Frontend Service in docker-compose.yml**
- Add `frontend` service
- Build context: `.`
- Depends on: `api`
- Environment: `FASTAPI_URL=http://api:8000`
- Port: `3000:3000`
- Healthcheck

**T03: Missing Healthchecks**
- Add celery-worker healthcheck (use `celery inspect ping`)
- Add telegram-bot healthcheck (process check)
- Verify all healthchecks pass in Docker

**T04: Database Migration on Startup**
- Update backend Dockerfile CMD to run migrations
- Or create entrypoint script
- Verify tables created on container start

**T05: CORS Update for Docker**
- Add `http://frontend:3000` to CORS origins (optional, depends on network)
- Or keep only localhost (if using port binding)

**T06: Smoke Test Script**
- Create `scripts/smoke-test.sh`
- Test: create project → update status → delete
- Run against localhost:3000 (frontend) and localhost:8000 (backend)
- Return exit code 0 on success, 1 on failure

**T07: Documentation Update**
- Update README.md with Docker Compose instructions
- Add smoke test command
- Document healthcheck endpoints
- List all service ports

## Constraints & Risks

### Docker Network Configuration

**Risk:** Service names vs localhost
- In Docker network: `api:8000`, `db:5432`, `rabbitmq:5672`
- From host: `localhost:8000`, `localhost:5432`, etc.
- Frontend uses `FASTAPI_URL` env var, must be set correctly

**Mitigation:** Document clearly, use default `http://api:8000` for frontend service env var

### Frontend Build Artifacts

**Risk:** `.next/standalone` must exist before Docker build
- Current build script creates it
- Docker build runs on fresh checkout (no `.next` directory)

**Solution:** Dockerfile should run `npm run build` as part of build stage

### Missing Service Dependencies

**Risk:** Services may start before dependencies are ready
- Current docker-compose.yml uses `depends_on` with healthchecks
- Frontend service needs similar dependency on `api`

**Pattern:** Follow existing pattern from `api` → `db` dependency

### Environment Variables

**Risk:** Missing required env vars in Docker
- Backend needs: DATABASE_URL, SECRET_KEY, JWT settings
- Frontend needs: FASTAPI_URL
- Optional services: Telegram, Email, LLM providers

**Mitigation:** Use `${VAR:-default}` pattern in docker-compose.yml (MEM053)

## Don't Hand-Roll

**Existing patterns to reuse:**
- Backend Dockerfile multi-stage build
- Healthcheck pattern from `api` service
- `depends_on` with `condition: service_healthy`
- Environment variable substitution syntax

**Don't create:**
- Custom healthcheck scripts (use existing endpoints)
- New network configurations (use existing `zakuppro-network`)
- Custom volume drivers (use existing `local` driver)

## Verification Strategy

### Build Verification
```bash
docker-compose build frontend  # Should succeed
docker-compose build --no-cache  # Full rebuild
```

### Health Verification
```bash
docker-compose up -d
docker-compose ps  # All services "healthy"
curl http://localhost:8000/health  # Backend OK
curl http://localhost:3000  # Frontend responds
```

### Smoke Test Verification
```bash
bash scripts/smoke-test.sh  # Exit code 0
```

### Service Integration Verification
```bash
# Create project via frontend API
curl -X POST http://localhost:3000/api/projects -d '{...}'
# Verify in backend
curl http://localhost:8000/api/projects | jq '.[0].name'
```

## Known Unknowns

1. **Frontend base image:** Should we use `node:20-slim` or `node:20-alpine`?
   - Slim is larger but more compatible
   - Alpine is smaller but may have musl libc issues

2. **Celery healthcheck method:** Can we use `celery inspect ping` in Docker healthcheck?
   - Requires celery CLI in PATH
   - May need additional configuration

3. **Migration timing:** When should migrations run?
   - In Dockerfile build (not recommended for dev)
   - In container entrypoint (recommended)
   - Manual step (current state, not production-ready)

4. **CORS in Docker:** Do we need `http://frontend:3000` in CORS origins?
   - Frontend API routes proxy to FastAPI (server-side)
   - Browser calls frontend, not FastAPI directly
   - May not be needed if using proper proxy pattern

## Recommendation

**Start with T01-T03** (Frontend Docker + healthchecks) as they unblock the full Docker Compose stack. T04 (migrations) is critical for data persistence. T05 (CORS) is optional and can be deferred. T06-T07 (smoke test + docs) are polish but important for handoff.

**Highest risk:** Missing database migrations on container startup could cause silent failures. **Prioritize T04.**

**First proof:** Get frontend service running and healthy in Docker Compose, then validate smoke test passes.
