---
id: T02
parent: S01
milestone: M002
key_files:
  - backend/celery_app.py
  - backend/tasks.py
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-01T10:10:10.861Z
blocker_discovered: false
---

# T02: Created Celery app with RabbitMQ broker, DLQ configuration, and dummy health check task

**Created Celery app with RabbitMQ broker, DLQ configuration, and dummy health check task**

## What Happened

Created `backend/celery_app.py` with Celery configuration:
- Broker URL: pyamqp://guest:guest@rabbitmq:5672// (RabbitMQ)
- Result backend: redis://redis:6379/0
- JSON serialization
- Europe/Moscow timezone
- Task time limit: 30 min (soft: 25 min)
- Late acknowledgments enabled

Configured DLQ (Dead Letter Queue) setup using Kombu:
- 'dlq' exchange (direct type, durable)
- 'dlq' queue for failed tasks
- 'default' queue with x-dead-letter-exchange='dlq' binding
- 24-hour message TTL

Created `backend/tasks.py` with three tasks:
- `tasks.dummy_health_check`: Returns status indicating worker is alive
- `tasks.add_numbers`: Example task for testing with parameters
- `tasks.failing_task`: Demonstrates retry behavior (max_retries=3) and DLQ routing

All tasks are automatically registered and visible in Celery app registry.

## Verification

Verified Celery app loads without errors. Confirmed tasks.dummy_health_check is registered with correct name. Validated queue configuration: 'default' queue has DLQ binding (x-dead-letter-exchange='dlq'), 'dlq' queue exists. Configuration values confirmed: JSON serializer, Europe/Moscow timezone, 30min hard limit, 25min soft limit.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -c 'from backend.celery_app import app; from backend.tasks import dummy_health_check; print("Celery app loaded")'` | 0 | pass | 850ms |
| 2 | `python -c 'from backend.celery_app import app; print("Registered tasks:", [t for t in app.tasks if "tasks." in t])'` | 0 | pass | 720ms |
| 3 | `python -c 'from backend.celery_app import default_queue; print("Default queue args:", default_queue.queue_arguments)'` | 0 | pass | 680ms |
| 4 | `python -c 'from backend.celery_app import app; print("Broker:", app.conf.broker_url, "Timezone:", app.conf.timezone)'` | 0 | pass | 750ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/celery_app.py`
- `backend/tasks.py`
