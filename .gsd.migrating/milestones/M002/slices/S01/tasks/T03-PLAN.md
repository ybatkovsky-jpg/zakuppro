---
estimated_steps: 16
estimated_files: 3
skills_used: []
---

# T03: Create Celery worker service and extend health check

## Why
Worker выполняет задачи. Health check показывает статус всех сервисов системы.

## Do
1. Добавить сервис `celery-worker` в `docker-compose.yml`:
   - Build context: `./backend`
   - Command: `celery -A backend.celery_app worker --loglevel=info`
   - Depends on: `rabbitmq` (condition: service_healthy)
   - Network: `zakuppro-network`
2. Расширить `backend/routers/health.py`:
   - Добавить проверку Celery worker через `app.control.inspect().ping()`
   - Вернуть статус всех сервисов: `{'status': 'ok', 'db': 'ok', 'rabbitmq': 'ok', 'celery_worker': 'ok'}`
3. Добавить `.env` переменную `CELERY_BROKER_URL=pyamqp://guest:guest@rabbitmq:5672//` (если отсутствует)

## Done when
- `docker-compose up celery-worker` показывает готовность принимать задачи
- `GET /health` возвращает `celery_worker: 'ok'`
- Dummy task выполняется и результат доступен в логах

## Inputs

- `docker-compose.yml`
- `backend/routers/health.py`
- `backend/celery_app.py`
- `backend/tasks.py`

## Expected Output

- `docker-compose.yml`
- `backend/routers/health.py`
- `.env`

## Verification

curl -s http://localhost:8000/health | grep -q 'celery_worker' && echo 'Celery health check works'

## Observability Impact

Health check агрегирует статусы: DB, RabbitMQ, Celery worker. Worker logs показывают task execution с timestamps.
