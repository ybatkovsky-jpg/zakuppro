# S01: Health Checks & Graceful Shutdown — UAT

**Milestone:** M007
**Written:** 2026-06-04T21:54:48.232Z

# S01 UAT: Health Checks & Graceful Shutdown

## UAT Type
Integration smoke test — manual verification that health endpoints return correct status and Docker stop is graceful.

## Preconditions
- All 7 services running via `docker-compose up -d`
- Heartbeat files being written by email-worker (every poll cycle) and telegram-bot (every 30s)
- Healthcheck data volume mounted at `/data/health` on api, email-worker, telegram-bot

## Test Steps

### TC1: GET /health returns all 7 services healthy
1. Wait at least 30s for first heartbeat from telegram-bot
2. `curl -s http://localhost:8000/health | python -m json.tool`
3. **Expected:** HTTP 200. Response includes `status: "ok"` and `services` object with all 5 keys: `db`, `rabbitmq`, `celery_worker`, `email_worker`, `telegram_bot` — all set to `"ok"`

### TC2: Stale heartbeat triggers degraded status
1. Stop the email-worker container: `docker-compose stop email-worker`
2. Wait 130s (exceed 120s staleness threshold)
3. `curl -s http://localhost:8000/health`
4. **Expected:** HTTP 503. `services.email_worker` = `"error"`, remaining services = `"ok"`

### TC3: Docker healthchecks report healthy
1. `docker-compose ps`
2. **Expected:** email-worker and telegram-bot show `(healthy)` in STATUS column, not `(unhealthy)` or `(health: starting)`

### TC4: Graceful shutdown — docker-compose stop
1. `docker-compose stop`
2. `docker logs zakuppro-celery-worker-1 2>&1 | grep "worker_shutdown"`
3. **Expected:** Log contains `Celery worker shutting down — active_tasks=N`
4. `docker logs zakuppro-telegram-bot-1 2>&1 | grep -E "SIGTERM|shutdown"`
5. **Expected:** Log contains `Received SIGTERM` and `Telegram bot shutdown complete`
6. All containers stop within their configured `stop_grace_period` (celery-worker=60s, email-worker=30s, telegram-bot=15s)

## Edge Cases
- **Heartbeat file doesn't exist yet** (first poll hasn't run): health endpoint returns `"error"` — system reports truthfully
- **Heartbeat file contains garbage**: health endpoint returns `"error"` — unparseable content treated as unhealthy
- **Simultaneous SIGTERM and heartbeat write**: atomic `os.replace()` prevents partial reads

## Not Proven By This UAT
- Celery task_acks_late + task re-delivery on worker restart (requires RabbitMQ persistence verification)
- End-to-end task survival through full Docker Compose restart (integration test, not smoke test)
- Multi-replica scenarios (single-container services only)
- Performance under load during shutdown
