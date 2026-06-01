# S04: Docker + Health Checks — UAT

**Milestone:** M001
**Written:** 2026-06-01T04:45:32.073Z

# S04: Docker + Health Checks — UAT

**Milestone:** M001
**Written:** 2026-06-01

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: Docker containerization and health checks require runtime verification to confirm services start properly and database connectivity works.

## Preconditions

- Docker and Docker Compose installed on the host machine
- No conflicting services on ports 5432 (PostgreSQL) or 8000 (FastAPI)
- Project repository cloned locally

## Smoke Test

```bash
docker-compose up -d
docker-compose ps
```

Expected: Both services show "healthy" status within 30 seconds.

## Test Cases

### 1. Services Start Successfully

1. Run `docker-compose up -d`
2. Wait 30 seconds
3. Run `docker-compose ps`
4. **Expected:** Both `zakuppro-db` and `zakuppro-api` show status "healthy"

### 2. Health Endpoint Returns Database Status

1. Ensure services are running
2. Run `curl http://localhost:8000/health`
3. **Expected:** Response with status 200 and body: `{"status": "ok", "db_status": "ok"}`

### 3. Database Dependency Ordering

1. Stop containers: `docker-compose down`
2. Start services: `docker-compose up -d`
3. Check API logs immediately: `docker-compose logs api`
4. **Expected:** API waits for database to be healthy before starting; no "connection refused" errors

### 4. API Documentation Accessible

1. Open browser to `http://localhost:8000/docs`
2. **Expected:** Swagger UI displays with all endpoints visible

## Edge Cases

### Database Connection Failure

1. Stop database service: `docker-compose stop db`
2. Wait 10 seconds
3. Run `curl http://localhost:8000/health`
4. **Expected:** Response with status 503 and body containing `"db_status": "error"`
5. Restart database: `docker-compose start db`
6. Run health check again
7. **Expected:** Health returns to 200 with `"db_status": "ok"`

### Port Conflicts

1. If ports 5432 or 8000 are already in use
2. **Expected:** docker-compose up fails with clear error message about port conflicts

## Failure Signals

- Services show "starting" status indefinitely (never reach "healthy")
- Health endpoint returns 503 or times out
- `docker-compose logs api` shows database connection errors
- `docker-compose ps` shows exited containers

## Not Proven By This UAT

- Production deployment on cloud platforms (AWS, GCP, Azure)
- SSL/TLS termination
- Horizontal scaling with multiple API instances
- Production database backup/restore procedures
- Long-running container stability (24+ hours)

## Notes for Tester

- First `docker-compose up` may take longer due to image downloads
- PostgreSQL healthcheck uses pg_isready with 5 retries over 30 seconds
- API healthcheck polls /health endpoint every 5 seconds
- All containers run as non-root user for security
- Database data persists in Docker volume `postgres_data`
