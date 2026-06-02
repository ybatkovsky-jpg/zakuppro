---
estimated_steps: 12
estimated_files: 1
skills_used: []
---

# T01: Configure RabbitMQ bank.statement exchange and queue

## Why
RabbitMQ needs a dedicated exchange and queue for bank statement processing. This isolates bank statement traffic from invoice processing and allows independent scaling and monitoring.

## Do
1. Add `bank_statement_exchange` (topic type, durable=True) to `backend/celery_app.py`
2. Add `bank_statement_queue` with routing_key='bank.statement' and DLQ binding
3. Update `app.conf.task_queues` to include the new queue
4. Add task routing for 'tasks.parse_bank_statement' → 'bank_statement_queue'

Follow the existing pattern for `default_exchange` and `dlq_exchange`. Use topic type to support future event types (bank.statement.parsed, bank.statement.failed).

## Done when
- Exchange and queue defined in celery_app.py
- Task routing configured
- Module imports successfully without errors

## Inputs

- `backend/celery_app.py`

## Expected Output

- `backend/celery_app.py`

## Verification

python -c "from backend.celery_app import app, bank_statement_exchange, bank_statement_queue; print('Exchange:', bank_statement_exchange.name); print('Queue:', bank_statement_queue.name); print('Queues:', len(app.conf.task_queues))"
