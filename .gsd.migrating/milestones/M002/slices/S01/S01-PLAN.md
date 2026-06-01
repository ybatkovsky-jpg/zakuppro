# S01: RabbitMQ + Celery Infrastructure

**Goal:** Установить RabbitMQ и настроить Celery worker для асинхронной обработки задач с DLQ и health check
**Demo:** RabbitMQ запущен, Celery worker обрабатывает dummy задачу, health check работает

## Must-Haves

- RabbitMQ запущен в Docker и доступен на портах 5672 и 15672
- Celery worker обрабатывает dummy задачу `tasks.dummy_health_check`
- Health check `/health` возвращает статусы всех сервисов (db, rabbitmq, celery_worker)
- DLQ очередь объявлена и видна в RabbitMQ management UI

## Proof Level

- This slice proves: integration

## Integration Closure

S01 создаёт инфраструктуру для S02 (Telegram Bot) и S03 (AI-Agent Worker). RabbitMQ доступен как `rabbitmq:5672` внутри Docker сети. Celery app registry позволяет добавлять задачи из разных модулей. Health check паттерн расширен для мониторинга всех сервисов.

## Verification

- RabbitMQ management UI (http://localhost:15672) показывает очереди, connections, DLQ. Celery worker logs в docker logs. Health check `/health` агрегирует статусы. DLQ сохраняет failed задачи с контекстом.

## Tasks

- [x] **T01: Add RabbitMQ service to Docker Compose** `est:20m`
  ## Why
  RabbitMQ — это message broker для Celery. Нужен до запуска worker'а.
  - Files: `docker-compose.yml`
  - Verify: docker-compose config rabbitmq 2>&1 | grep -q 'rabbitmq:3-management' && echo 'RabbitMQ service defined'

- [x] **T02: Create Celery app configuration with DLQ setup** `est:40m`
  ## Why
  Celery app — это точка конфигурации для всех tasks. DLQ нужен для обработки failed задач.
  - Files: `backend/celery_app.py`, `backend/tasks.py`
  - Verify: cd backend && python -c 'from backend.celery_app import app; from backend.tasks import dummy_health_check; print("Celery app loaded")'

- [x] **T03: Create Celery worker service and extend health check** `est:40m`
  ## Why
  Worker выполняет задачи. Health check показывает статус всех сервисов системы.
  - Files: `docker-compose.yml`, `backend/routers/health.py`, `.env`
  - Verify: curl -s http://localhost:8000/health | grep -q 'celery_worker' && echo 'Celery health check works'

## Files Likely Touched

- docker-compose.yml
- backend/celery_app.py
- backend/tasks.py
- backend/routers/health.py
- .env
