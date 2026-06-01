# M002: Asynchronous Core + AI-Agent Foundation

**Vision:** Создать асинхронное ядро системы с message broker и AI-агентом для автоматической обработки спецификаций (BOM) из Excel файлов, загружаемых через Telegram Bot.

## Success Criteria

- Владелец может загрузить Excel через Telegram и получить Project в БД
- Telegram Bot авторизует по chat_id из .env
- RabbitMQ + Celery обрабатывают задачи асинхронно
- OpenAI GPT-4o распознаёт dirty Excel структуры
- DLQ сохраняет контекст ошибок
- Telegram alerts отправляются при проблемах
- Health check показывает статус всех сервисов
- Сервисы изолированы в Docker (падение worker не останавливает bot)

## Slices

- [x] **S01: S01** `risk:medium` `depends:[]`
  > After this: RabbitMQ запущен, Celery worker обрабатывает dummy задачу, health check работает

- [x] **S02: S02** `risk:high` `depends:[]`
  > After this: Telegram Bot принимает Excel файл от разрешённого chat_id, сохраняет локально, публикует задачу в RabbitMQ

- [ ] **S03: S03** `risk:high` `depends:[]`
  > After this: Celery task парсит Excel с pandas, вызывает GPT-4o для распознавания структуры, возвращает JSON с данными

- [ ] **S04: Project Creation + DLQ** `risk:high` `depends:[S02,S03]`
  > After this: End-to-end: Excel из Telegram → Project в БД → ответ в Telegram со статистикой. DLQ работает при ошибках.

## Boundary Map

### S01 → S02, S03, S04

Produces:
- RabbitMQ service accessible at `rabbitmq:5672`
- Celery worker infrastructure with task registry
- Health check endpoint at `/health` returning status of all services
- DLQ queue configuration

Consumes:
- nothing (first slice)

### S02 → S04

Produces:
- Telegram Bot service accepting Excel files
- File persistence in volume mount
- Task publication to RabbitMQ `process_bom` queue
- chat_id authorization via `ALLOWED_CHAT_IDS` env var

Consumes:
- RabbitMQ connection from S01
- Health check infrastructure from S01

### S03 → S04

Produces:
- Celery task `parse_excel_bom` for Excel processing
- pandas-based Excel reading
- OpenAI GPT-4o integration for structure recognition
- Prompt construction for dirty table handling
- JSON output with recognized columns (sku, name, qty, supplier)

Consumes:
- RabbitMQ connection from S01
- DLQ queue from S01

### S04 → Integration

Produces:
- End-to-end flow integration
- Project creation via existing FastAPI endpoints
- DLQ table with failed task context
- Telegram alerts for DLQ events
- Full observability across all services

Consumes:
- Telegram Bot from S02
- Excel parsing task from S03
- RabbitMQ infrastructure from S01
- FastAPI endpoints from M001
