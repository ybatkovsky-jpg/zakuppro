# S05: Production Readiness Polish — UAT

**Milestone:** M005
**Written:** 2026-06-03T12:39:37.799Z

# S05 UAT: Production Readiness Polish

## Test Scenario: Docker Compose Stack Startup

### Preconditions
- Docker and Docker Compose installed
- Project cloned and .env configured

### Test Steps

1. **Start all services**
   ```bash
   docker-compose up -d
   ```

2. **Verify all services healthy**
   ```bash
   docker-compose ps
   ```
   Expected: All 7 services show "healthy" status
   - db (PostgreSQL)
   - api (FastAPI backend)
   - rabbitmq (Message broker)
   - email-worker (IMAP ingest)
   - celery-worker (Async tasks)
   - telegram-bot (Telegram integration)
   - frontend (Next.js UI)

3. **Check health endpoints**
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:3000
   ```
   Expected: Both return HTTP 200

4. **Run smoke test**
   ```bash
   bash scripts/smoke-test.sh
   ```
   Expected: All 7 steps pass, exit code 0

5. **Check logs for errors**
   ```bash
   docker-compose logs --tail=50
   ```
   Expected: No critical errors

6. **Shutdown**
   ```bash
   docker-compose down
   ```
   Expected: All containers stop cleanly

### Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | — |
| Backend API | http://localhost:8000 | admin / admin123 |
| API Docs | http://localhost:8000/docs | — |
| RabbitMQ UI | http://localhost:15672 | guest / guest |
