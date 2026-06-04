---
estimated_steps: 20
estimated_files: 1
skills_used: []
---

# T02: Frontend Service in docker-compose.yml

Add the frontend service to docker-compose.yml with proper dependencies, environment variables, and health check.

**Why:** Frontend needs to be part of the Docker Compose stack to start automatically with other services.

**Do:**
1. Add `frontend` service to docker-compose.yml after `telegram-bot`:
   - build: context: ., dockerfile: Dockerfile
   - container_name: zakuppro-frontend
   - environment:
     - FASTAPI_URL=http://api:8000 (Docker network hostname)
   - ports: 3000:3000
   - depends_on:
     - api with condition: service_healthy
   - healthcheck: test curl localhost:3000, interval 30s, timeout 10s, retries 3, start_period 10s
   - networks: zakuppro-network
2. Update README style to match other services

**Constraints:**
- Use `http://api:8000` for FASTAPI_URL (internal Docker network)
- depends_on must wait for api to be healthy
- Follow existing healthcheck pattern from other services
- Add to zakuppro-network

**Done when:** docker-compose.yml has frontend service defined and `docker-compose config frontend` validates it

## Inputs

- `docker-compose.yml`
- `Dockerfile`

## Expected Output

- `docker-compose.yml`

## Verification

docker-compose config | grep -A 20 'frontend'

## Observability Impact

Health check shows frontend as healthy in docker-compose ps. Logs expose startup failures.
