---
estimated_steps: 12
estimated_files: 2
skills_used: []
---

# T02: Create docker-compose.yml and .dockerignore

## Why
Orchestrates PostgreSQL and FastAPI containers with proper health checks and startup ordering. Docker Compose ensures database is ready before API starts, preventing connection errors.

## Do
1. Create `docker-compose.yml` in project root with:
   - **Service db**: PostgreSQL 15-alpine image, pg_isready healthcheck, volume for persistence
   - **Service api**: Build from backend/Dockerfile, healthcheck using curl to /health, depends_on db with condition: service_healthy
   - **Network**: zakuppro-network bridge for isolation
   - **Environment**: DATABASE_URL from .env for both services
2. Create `.dockerignore` to exclude: `__pycache__`, `.git`, `.pytest_cache`, `node_modules`, `.gsd`, `*.db`, skills/
3. Expose PostgreSQL port 5432 and API port 8000 to host

## Done when
`docker-compose up -d` starts both services, `docker-compose ps` shows both as healthy.

## Inputs

- `backend/Dockerfile`
- `.env`

## Expected Output

- `docker-compose.yml`
- `.dockerignore`

## Verification

docker-compose up -d && timeout 60 sh -c 'until docker-compose ps | grep -q healthy; do sleep 2; done'
