# S01: RabbitMQ + Celery Infrastructure - Research

**Gathered:** 2026-06-01
**Status:** Complete

## Summary

S01 establishes the foundational message queue infrastructure for M002. The research confirms that Celery 5.4.0 (already in requirements.txt) paired with RabbitMQ provides a robust async task system with DLQ support. Key findings: (1) RabbitMQ runs in Docker with management UI on port 15672; (2) Celery workers connect via `pyamqp://` broker URL; (3) DLQ configuration requires RabbitMQ-level queue arguments; (4) Health checks use `celery inspect ping` or custom HTTP endpoint; (5) Kombu library (Celery's messaging layer) handles queue declarations programmatically.

## Requirements Context

This slice delivers **R002** (RabbitMQ + Celery for async task processing with retry and DLQ). The infrastructure serves as the foundation for S02 (Telegram Bot) and S03 (AI-Agent Worker) which will publish/consume tasks.

## Existing Codebase Analysis

### Dependencies Already Available

`backend/requirements.txt` contains:
- `celery==5.4.0` ✅
- `redis==5.2.0` (not needed for RabbitMQ, but available)
- `python-telegram-bot==21.10` (for S02)

### Docker Compose Structure

`docker-compose.yml` currently has:
- `db`: PostgreSQL 15 with healthcheck
- `api`: FastAPI service with healthcheck on `/health`
- Shared network: `zakuppro-network`

**Gap analysis:** No RabbitMQ service, no Celery worker service.

### Health Check Pattern

`backend/routers/health.py` implements basic DB connectivity check. Pattern established: simple endpoint returning `{"status": "ok"}` with optional service statuses. S01 should extend this to include Celery worker status.

## Technology Deep Dive

### RabbitMQ Configuration

**Image:** `rabbitmq:3-management` (includes management UI)

**Key ports:**
- `5672`: AMQP protocol (broker communication)
- `15672`: Management UI (HTTP)

**Docker service requirements:**
```yaml
rabbitmq:
  image: rabbitmq:3-management
  ports:
    - "5672:5672"
    - "15672:15672"
  environment:
    RABBITMQ_DEFAULT_USER: guest
    RABBITMQ_DEFAULT_PASS: guest
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "ping"]
```

### Celery Configuration

**Broker URL format:** `pyamqp://guest:guest@rabbitmq:5672//`

**Key configuration for S01:**
```python
from celery import Celery

app = Celery('zakuppro',
             broker='pyamqp://guest:guest@rabbitmq:5672//',
             backend='rpc://')  # For task results

# Retry configuration
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Europe/Moscow',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
)
```

### DLQ Setup Pattern

**RabbitMQ-side DLQ queue declaration** (via Kombu/Celery or management UI):
```python
from kombu import Queue, Exchange

# Define DLQ exchange and queue
dlq_exchange = Exchange('dlq', type='direct')
dlq_queue = Queue('dlq', dlq_exchange, routing_key='dlq')

# Main queue with DLQ arguments
task_queue = Queue(
    'process_bom',
    Exchange('default', type='direct'),
    routing_key='process_bom',
    queue_arguments={
        'x-dead-letter-exchange': 'dlq',
        'x-dead-letter-routing-key': 'dlq'
    }
)
```

**Celery task retry configuration:**
```python
@app.task(bind=True, max_retries=2)
def parse_excel_bom(self, file_path: str):
    try:
        # Task logic
        pass
    except Exception as exc:
        # Exponential backoff: 1s, 5s
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
```

### Worker Health Check

**Docker HEALTHCHECK approach:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD celery -A backend.celery_app inspect ping || exit 1
```

**Alternative HTTP endpoint** (in `celery_worker.py`):
```python
@app.get("/health")
async def health():
    try:
        inspect = app.control.inspect(timeout=1.0)
        stats = inspect.stats()
        return {"status": "ok", "workers": len(stats or {})}
    except:
        raise HTTPException(503)
```

## Files to Create or Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/celery_app.py` | Celery app instance with broker/backend config |
| `backend/worker.py` | Dummy task for S01 verification |
| `backend/celery_worker.py` | Optional: HTTP health check endpoint for workers |

### Modified Files

| File | Changes |
|------|---------|
| `docker-compose.yml` | Add `rabbitmq` and `celery-worker` services |
| `backend/routers/health.py` | Add Celery worker status check |
| `.env` | Add `RABBITMQ_URL` (or use Docker defaults) |

## Implementation Landscape

### Docker Service Architecture

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: zakuppro-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
    networks:
      - zakuppro-network

  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: zakuppro-celery-worker
    command: celery -A backend.celery_app worker --loglevel=info
    environment:
      BROKER_URL: pyamqp://guest:guest@rabbitmq:5672//
    depends_on:
      rabbitmq:
        condition: service_healthy
    networks:
      - zakuppro-network

volumes:
  rabbitmq_data:
```

### Task Definition Pattern

```python
# backend/worker.py
from backend.celery_app import app

@app.task(name='tasks.dummy_health_check')
def dummy_health_check():
    """Dummy task for S01 verification."""
    return {"status": "ok", "message": "Celery worker is alive"}
```

### Verification Sequence

1. `docker-compose up -d rabbitmq` → Verify management UI at `http://localhost:15672`
2. `docker-compose up -d celery-worker` → Check logs for "ready to accept tasks"
3. Trigger task via Python shell or HTTP endpoint
4. Verify task execution in worker logs
5. Check `/health` returns Celery worker status

## Constraints and Gotchas

### RabbitMQ Container Name

Use service name `rabbitmq` as hostname in broker URL, not `localhost` or `localhost:15672`. This matches the Docker network pattern established for `db` service.

### Celery Worker Start Command

Must use `-A backend.celery_app` to point to the app module. The module should be importable from the project root.

### DLQ Queue Declaration

DLQ queues must be declared **before** tasks are published. Either:
- Declare in `celery_app.py` using Kombu's Queue API
- Use management UI to pre-configure queues
- Use Celery's `app.conf.task_queues` configuration

### Retry Exponential Backoff

Celery's `countdown` parameter accepts either:
- Fixed seconds: `countdown=5`
- Exponential: `countdown=2 ** retries` (0 retries → 1s, 1 retry → 2s, 2 retries → 4s)

## Don't Hand-Roll

Use these libraries instead of building from scratch:

| Concern | Use | Avoid |
|---------|-----|-------|
| Task queue | Celery | Custom Redis pub/sub or handrolled AMQP |
| DLQ | RabbitMQ native DLX | Custom "failed_tasks" table for retry logic |
| Serialization | Celery's built-in JSON | Manual pickle/msgpack |
| Health checks | `celery inspect ping` | Custom TCP/HTTP probes without Celery awareness |

## Sources

- [Celery 5.4.0 Documentation - First Steps](https://docs.celeryq.dev/en/v5.4.0/getting-started/first-steps-with-celery.html)
- [Celery 5.4.0 Documentation - Using RabbitMQ](https://docs.celeryq.dev/en/v5.4.0/getting-started/backends-and-brokers/rabbitmq.html)
- [RabbitMQ Official Docs - Dead Letter Exchanges](https://www.rabbitmq.com/docs/dlx)
- [How to Run RabbitMQ in Docker Compose](https://medium.com/@kaloyanmanev/how-to-run-rabbitmq-in-docker-compose-e5baccc3e644)
- [Docker Health Check for Celery Workers](https://celery.school/docker-health-check-for-celery-workers)
- [Celery Health Check on GitHub](https://github.com/iloveitaly/celery-healthcheck)
- [Building Resilient Task Queue with Exponential Backoff and DLQ](https://medium.com/@erwindev/building-a-resilient-task-queue-with-exponential-backoff-and-dead-letter-queues-f60aa0a01d0d)
- [How to create a dead letter queue in Celery + RabbitMQ](https://medium.com/@hengfeng/how-to-create-a-dead-letter-queue-in-celery-rabbitmq-401b17c72cd3)

## Recommendations

1. **Use RabbitMQ management plugin** for visibility during development (port 15672)
2. **Create `backend/celery_app.py`** as the single source of truth for Celery configuration
3. **Implement dummy task first** before adding real Excel parsing logic
4. **Add Docker volume** for RabbitMQ data persistence
5. **Extend `/health` endpoint** to return `{"status": "ok", "db": "ok", "rabbitmq": "ok", "celery_worker": "ok"}`
6. **Configure DLQ queue in code** using Kombu Queue declarations, not management UI
7. **Use exponential backoff** via `countdown=2 ** retries` pattern in task retry logic

## Forward Intelligence

### Fragility Points

- **RabbitMQ container restart**: Messages may be lost if queues aren't durable. Set `durable=True` on queue declarations.
- **Celery worker crash during task**: Task may be redelivered. Tasks should be idempotent where possible.
- **Broker URL mismatch**: Using `localhost` instead of `rabbitmq` service name causes connection errors.

### Changed Assumptions

- None from M001. Docker service name pattern (`db`, `rabbitmq`) is consistent.

### Watch-Outs

- **Python version mismatch**: Dockerfile uses `python:3.11-slim` but requirements.txt may expect 3.14+. Verify compatibility.
- **Celery 5.4 requires Python 3.8+**: Confirmed compatible with 3.11.
- **Redis dependency**: `requirements.txt` includes `redis==5.2.0` but S01 uses RabbitMQ. No conflict, but unused.
- **Management UI security**: Guest credentials are fine for local dev but must be changed for production.

## Skills Discovered

The following skills may be relevant but were NOT installed:

- `mindrally/skills@rabbitmq-development` (567 installs) — RabbitMQ development guidance
- `martinholovsky/claude-skills-generator@celery-expert` (324 installs) — Celery expert patterns
- `sickn33/antigravity-awesome-skills@docker-expert` (17.6K installs) — Docker containerization

Install with: `npx skills add <owner/repo@skill>`