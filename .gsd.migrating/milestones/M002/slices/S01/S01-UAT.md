# S01: RabbitMQ + Celery Infrastructure — UAT

**Milestone:** M002
**Written:** 2026-06-01T10:16:42.623Z

# UAT: RabbitMQ + Celery Infrastructure

## UAT Type
Integration Verification

## Preconditions
1. Docker and Docker Compose installed
2. .env file contains CELERY_BROKER_URL=pyamqp://guest:guest@rabbitmq:5672//
3. No conflicting services on ports 5672, 15672, 8000

## Test Steps

### 1. Start Services
```bash
docker-compose up -d rabbitmq celery-worker backend
```
**Expected**: All containers start successfully; celery-worker waits for rabbitmq healthcheck

### 2. Verify RabbitMQ Management UI
1. Navigate to http://localhost:15672
2. Login with guest/guest
**Expected**: Management UI displays; queues tab shows 'default' and 'dlq' queues

### 3. Verify Celery Worker Health
```bash
curl http://localhost:8000/health
```
**Expected**: Response includes `"celery_worker": "ok"` and `"rabbitmq": "ok"`

### 4. Test Dummy Task
```bash
docker exec backend python -c "from backend.tasks import dummy_health_check; result = dummy_health_check.delay(); print(result.get(timeout=10))"
```
**Expected**: Returns dict with status='ok', message='Celery worker is alive', task_id

### 5. Verify DLQ
```bash
docker exec backend python -c "from backend.tasks import failing_task; failing_task.delay()"
# Wait for retries to exhaust, then check RabbitMQ UI
```
**Expected**: Task appears in DLQ after max_retries exhausted

### 6. Service Recovery Test
```bash
docker-compose stop rabbitmq
docker-compose ps  # Should show unhealthy services
docker-compose start rabbitmq
# Wait for healthcheck recovery
curl http://localhost:8000/health
```
**Expected**: Health returns 503 while RabbitMQ down, recovers when RabbitMQ restarts

## Edge Cases
- Worker crash: Verify tasks remain queued, execute on worker restart
- Broker restart: Verify worker reconnection, task queue preservation
- Network partition: Verify health check reflects degradation

## Not Proven By This UAT
- Telegram Bot integration (S02)
- Excel parsing with AI-Agent (S03)
- End-to-end BOM processing flow (S04)
- Production deployment configuration
