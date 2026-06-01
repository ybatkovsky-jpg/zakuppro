---
estimated_steps: 14
estimated_files: 1
skills_used: []
---

# T01: Add RabbitMQ service to Docker Compose

## Why
RabbitMQ — это message broker для Celery. Нужен до запуска worker'а.

## Do
1. Добавить сервис `rabbitmq` в `docker-compose.yml`:
   - Image: `rabbitmq:3-management` (с management UI)
   - Ports: `5672:5672` (AMQP), `15672:15672` (UI)
   - Environment: `RABBITMQ_DEFAULT_USER=guest`, `RABBITMQ_DEFAULT_PASS=guest`
   - Volume: `rabbitmq_data` для персистентности
   - Healthcheck: `rabbitmq-diagnostics -q ping`
   - Network: `zakuppro-network`
2. Добавить volume `rabbitmq_data` в секцию `volumes`

## Done when
- `docker-compose up -d rabbitmq` стартует без ошибок
- Management UI доступен на http://localhost:15672 (guest/guest)

## Inputs

- `docker-compose.yml`

## Expected Output

- `docker-compose.yml`

## Verification

docker-compose config rabbitmq 2>&1 | grep -q 'rabbitmq:3-management' && echo 'RabbitMQ service defined'

## Observability Impact

RabbitMQ logs доступны через docker logs zakuppro-rabbitmq. Management UI показывает очереди и connections.
