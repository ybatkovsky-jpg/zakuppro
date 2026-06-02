---
id: T01
parent: S03
milestone: M004
key_files:
  - backend/celery_app.py
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-02T09:23:56.675Z
blocker_discovered: false
---

# T01: Configured RabbitMQ bank.statement exchange and queue with DLQ binding and task routing

**Configured RabbitMQ bank.statement exchange and queue with DLQ binding and task routing**

## What Happened

Added bank_statement_exchange (topic type, durable=True) and bank_statement_queue to backend/celery_app.py following the existing pattern for default_exchange and dlq_exchange. The queue includes DLQ binding with x-dead-letter-exchange and x-message-ttl. Updated app.conf.task_queues to include the new queue (now 3 queues total). Added task routing for 'tasks.parse_bank_statement' -> 'bank_statement' in task_routes, which takes precedence over the catch-all 'tasks.*' -> 'default' route.

## Verification

Verified that module imports successfully, exchange name is 'bank.statement', queue name is 'bank_statement', and app.conf.task_queues contains 3 queues. Verified task routing correctly maps tasks.parse_bank_statement to bank_statement queue.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -c "from backend.celery_app import app, bank_statement_exchange, bank_statement_queue; print('Exchange:', bank_statement_exchange.name); print('Queue:', bank_statement_queue.name); print('Queues:', len(app.conf.task_queues))"` | 0 | pass | 1200ms |
| 2 | `python -c "from backend.celery_app import app; print('Task routes:', app.conf.task_routes)"` | 0 | pass | 800ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/celery_app.py`
