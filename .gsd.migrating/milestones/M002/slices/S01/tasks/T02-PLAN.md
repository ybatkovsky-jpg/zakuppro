---
estimated_steps: 18
estimated_files: 2
skills_used: []
---

# T02: Create Celery app configuration with DLQ setup

## Why
Celery app — это точка конфигурации для всех tasks. DLQ нужен для обработки failed задач.

## Do
1. Создать `backend/celery_app.py`:
   - Celery instance с broker URL `pyamqp://guest:guest@rabbitmq:5672//`
   - Task serializer: json
   - Timezone: Europe/Moscow
   - Task time limit: 30 min, soft limit: 25 min
2. Создать `backend/tasks.py` с dummy task:
   - `@app.task(name='tasks.dummy_health_check')`
   - Возвращает `{'status': 'ok', 'message': 'Celery worker is alive'}`
3. Добавить DLQ queue через Kombu:
   - Exchange 'dlq' (type='direct')
   - Queue 'dlq' с routing_key='dlq'
   - Main queue с x-dead-letter-exchange='dlq'

## Done when
- Модуль импортируется без ошибок: `python -c 'from backend.celery_app import app; print(app)'
- Задача зарегистрирована: `celery -A backend.celery_app inspect registered` показывает `tasks.dummy_health_check`

## Inputs

- `backend/requirements.txt`

## Expected Output

- `backend/celery_app.py`
- `backend/tasks.py`

## Verification

cd backend && python -c 'from backend.celery_app import app; from backend.tasks import dummy_health_check; print("Celery app loaded")'

## Observability Impact

Celery logs показывают task execution. DLQ виден в RabbitMQ management UI.
