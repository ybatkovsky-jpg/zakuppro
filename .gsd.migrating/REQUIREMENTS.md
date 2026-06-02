# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R003 — AI-Agent Worker для парсинга Excel файлов с помощью pandas и распознавания структуры таблиц (артикул, название, поставщик) через GPT-4o
- Class: core-capability
- Status: active
- Description: AI-Agent Worker для парсинга Excel файлов с помощью pandas и распознавания структуры таблиц (артикул, название, поставщик) через GPT-4o
- Why it matters: Автоматизация создания BOM из Excel. LLM нужна для dirty таблиц (объединенные ячейки, многоэтажные шапки).
- Source: user
- Primary owning slice: M002
- Validation: S03 verification passed: Celery task parse_excel_bom registered with @app.task, pandas reads Excel files, OpenAI GPT-4o extracts structure with json_schema, Pydantic validates output. Test file sample_bom.xlsx with Russian headers validates dirty table handling.

### R008 — Сверка счетов (Invoice Verification) через LLM с fuzzy matching для опечаток в названиях и артикулах
- Class: core-capability
- Status: active
- Description: Сверка счетов (Invoice Verification) через LLM с fuzzy matching для опечаток в названиях и артикулах
- Why it matters: Поставщики часто меняют названия. Fuzzy matching + LLM позволяет автоматически сверять счета с заказами.
- Source: user
- Primary owning slice: M003
- Validation: S01: InvoiceItem table created with sku, name, qty columns; Invoice.verification_result JSONB column; llm_provider.py wrapper supports OpenAI, Gemini, Claude with automatic fallback. S04: 9 integration tests verify exact SKU matching, RapidFuzz fuzzy name matching (>85% threshold), quantity discrepancy detection. Fuzzy matching logic complete with multi-tier strategy: exact SKU → OK, SKU differs + 85% similarity → clarification, quantity differs → partial.

### R009 — Bank Worker для загрузки выписки (по API банка или через email) и мапинга платежей к счетам по ИНН и сумме
- Class: integration
- Status: active
- Description: Bank Worker для загрузки выписки (по API банка или через email) и мапинга платежей к счетам по ИНН и сумме
- Why it matters: Автоматическое сверки财务管理. Платежи должны привязываться к счетам без ручного труда.
- Source: user
- Primary owning slice: M004

### R010 — UnresolvedTransaction таблица для платежей которые не удалось привязать автоматически, с UI для ручной сортировки
- Class: admin/support
- Status: active
- Description: UnresolvedTransaction таблица для платежей которые не удалось привязать автоматически, с UI для ручной сортировки
- Why it matters: Не все платежи маппятся автоматически. Бухгалтер должен иметь возможность разобрать несопоставленные операции.
- Source: user
- Primary owning slice: M004

### R011 — Frontend UI (Next.js + Ant Design) с Kanban-досками проектов, таблицами спецификаций и экраном комплектации
- Class: primary-user-loop
- Status: active
- Description: Frontend UI (Next.js + Ant Design) с Kanban-досками проектов, таблицами спецификаций и экраном комплектации
- Why it matters: Менеджерам нужен визуальный интерфейс для управления проектами, статусами и комплектации.
- Source: user
- Primary owning slice: M005

### R012 — Kanban-логика с блокировками: переход в "Производство" невозможен пока не все позиции "На складе" или "Оплачено"
- Class: core-capability
- Status: active
- Description: Kanban-логика с блокировками: переход в "Производство" невозможен пока не все позиции "На складе" или "Оплачено"
- Why it matters: Предотвращение ошибок. Нельзя запускать в производство недоукомплектованные проекты.
- Source: user
- Primary owning slice: M006

### R013 — Резервирование на складе: при создании BOM автоматически резервирует доступные StockItem, списывает при выдаче в производство
- Class: core-capability
- Status: active
- Description: Резервирование на складе: при создании BOM автоматически резервирует доступные StockItem, списывает при выдаче в производство
- Why it matters: Прозрачность остатков. Менеджеры видят реальные доступные количества, а не общие остатки.
- Source: user
- Primary owning slice: M006

### R014 — Матрица готовности проекта: цветовая индикация (Зелёный — всё есть, Жёлтый — часть в пути, Красный — не заказано)
- Class: operability
- Status: active
- Description: Матрица готовности проекта: цветовая индикация (Зелёный — всё есть, Жёлтый — часть в пути, Красный — не заказано)
- Why it matters: Быстрая оценка комплектации. Менеджер видит статус проекта на одном экране.
- Source: user
- Primary owning slice: M006

## Validated

### R001 — Telegram Bot для приёма Excel файлов от владельца, авторизации по chat_id, и отправки уведомлений о статусе операций
- Class: integration
- Status: validated
- Description: Telegram Bot для приёма Excel файлов от владельца, авторизации по chat_id, и отправки уведомлений о статусе операций
- Why it matters: Единый entry point для владельца. Позволяет загружать BOM мобильно и получать оповещения о проблемах.
- Source: user
- Primary owning slice: M002
- Validation: S02 implemented document handler, authorization middleware (AuthMiddleware with ALLOWED_CHAT_IDS), file persistence, and outbound Telegram notifications via telegram_notifier.py. S02-UAT.md TC1-TC2 verify authorization and access.

### R002 — RabbitMQ + Celery для асинхронной обработки задач (Excel parsing, LLM calls, email отправка) с retry и DLQ
- Class: core-capability
- Status: validated
- Description: RabbitMQ + Celery для асинхронной обработки задач (Excel parsing, LLM calls, email отправка) с retry и DLQ
- Why it matters: Тяжёлые операции (LLM, парсинг) не должны блокировать API. Queue обеспечивает надёжность и повторную обработку при ошибках.
- Source: user
- Primary owning slice: M002
- Validation: S01 established RabbitMQ 3-management with DLQ configuration, Celery worker service with health checks. S01-UAT.md verifies RabbitMQ and Celery worker connectivity.

### R004 — Flow 1: Загрузка BOM через Telegram → парсинг Excel → создание Project + ProjectItem в БД → ответ владельцу со статистикой
- Class: core-capability
- Status: validated
- Description: Flow 1: Загрузка BOM через Telegram → парсинг Excel → создание Project + ProjectItem в БД → ответ владельцу со статистикой
- Why it matters: Критический user loop. Владелец должен иметь возможность создать проект из Excel без использования UI.
- Source: user
- Primary owning slice: M002
- Validation: S04 process_bom_to_project orchestrates full flow: Excel from Telegram → AI parsing → Project/ProjectItem DB creation → Telegram notifications. Integration test test_process_bom_to_project_task_success verifies.

### R005 — DLQ (Dead Letter Queue) для задач которые не удались после retry, с сохранением контекста (промпт, ответ LLM, Excel path) и alert в Telegram
- Class: failure-visibility
- Status: validated
- Description: DLQ (Dead Letter Queue) для задач которые не удались после retry, с сохранением контекста (промпт, ответ LLM, Excel path) и alert в Telegram
- Why it matters: Ничто не должно теряться. Владелец должен видеть проблемы и иметь возможность перезапустить или исправить вручную.
- Source: user
- Primary owning slice: M002
- Validation: S04 implemented FailedTask model with task_id, error_message, file_path, chat_id, context. DLQ alert via send_dlq_alert to TELEGRAM_OWNER_CHAT_ID. Integration test confirms error path.

### R006 — Telegram Bot как отдельный Docker сервис с авторизацией через ALLOWED_CHAT_IDS из .env
- Class: operability
- Status: validated
- Description: Telegram Bot как отдельный Docker сервис с авторизацией через ALLOWED_CHAT_IDS из .env
- Why it matters: Изоляция сервисов. Bot может падать или рестартоваться независимо от API и workers.
- Source: user
- Primary owning slice: M002
- Validation: S02 added telegram-bot service to docker-compose.yml with restart: unless-stopped, volume mounts, and ALLOWED_CHAT_IDS environment variable for authorization.

### R007 — Email Worker (SMTP outbound) для отправки запросов поставщикам с копией на рабочую почту компании
- Class: integration
- Status: validated
- Description: Email Worker (SMTP outbound) для отправки запросов поставщикам с копией на рабочую почту компании
- Why it matters: Автоматизация коммуникации с поставщиками. Шаблонные письма должны отправляться без участия менеджера.
- Source: user
- Primary owning slice: M003
- Validation: S05 verification passed: email_notifier.py implements SMTP outbound with aiosmtplib async client. 19 tests covering config validation, email building, async SMTP operations, Russian content. send_clarification_email sends to supplier with BCC to company. Non-blocking pattern matches telegram_notifier.

## Deferred

### R015 — Graceful shutdown и cleanup для всех сервисов (Celery workers, Telegram bot, FastAPI) с сохранением состояния задач
- Class: continuity
- Status: deferred
- Description: Graceful shutdown и cleanup для всех сервисов (Celery workers, Telegram bot, FastAPI) с сохранением состояния задач
- Why it matters: Сервисы должны останавливаться корректно, не теряя обрабатываемые задачи.
- Source: inferred
- Primary owning slice: none

### R016 — Health check endpoints для всех сервисов (FastAPI, Celery workers, Telegram bot) для мониторинга статуса
- Class: quality-attribute
- Status: deferred
- Description: Health check endpoints для всех сервисов (FastAPI, Celery workers, Telegram bot) для мониторинга статуса
- Why it matters: Operational visibility. Нужно знать состояние всех компонентов системы.
- Source: inferred
- Primary owning slice: none

### R017 — DLQ UI/админка для просмотра и перезапуска неудачных задач с деталями ошибок
- Class: admin/support
- Status: deferred
- Description: DLQ UI/админка для просмотра и перезапуска неудачных задач с деталями ошибок
- Why it matters: Удобное управление ошибками без запросов к БД или логам.
- Source: inferred
- Primary owning slice: M005

### R018 — Ролевая модель в Web UI: Владелец (видит всё), Менеджер (только свои проекты), Склад (только остатки)
- Class: compliance/security
- Status: deferred
- Description: Ролевая модель в Web UI: Владелец (видит всё), Менеджер (только свои проекты), Склад (только остатки)
- Why it matters: Безопасность доступа. Разные пользователи должны видеть только свои данные.
- Source: user
- Primary owning slice: M005

### R019 — Retry с exponential backoff для всех external calls (OpenAI API, email, bank API)
- Class: quality-attribute
- Status: deferred
- Description: Retry с exponential backoff для всех external calls (OpenAI API, email, bank API)
- Why it matters: Надёжность при временных сбоях внешних сервисов.
- Source: inferred
- Primary owning slice: none

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | integration | validated | M002 | none | S02 implemented document handler, authorization middleware (AuthMiddleware with ALLOWED_CHAT_IDS), file persistence, and outbound Telegram notifications via telegram_notifier.py. S02-UAT.md TC1-TC2 verify authorization and access. |
| R002 | core-capability | validated | M002 | none | S01 established RabbitMQ 3-management with DLQ configuration, Celery worker service with health checks. S01-UAT.md verifies RabbitMQ and Celery worker connectivity. |
| R003 | core-capability | active | M002 | none | S03 verification passed: Celery task parse_excel_bom registered with @app.task, pandas reads Excel files, OpenAI GPT-4o extracts structure with json_schema, Pydantic validates output. Test file sample_bom.xlsx with Russian headers validates dirty table handling. |
| R004 | core-capability | validated | M002 | none | S04 process_bom_to_project orchestrates full flow: Excel from Telegram → AI parsing → Project/ProjectItem DB creation → Telegram notifications. Integration test test_process_bom_to_project_task_success verifies. |
| R005 | failure-visibility | validated | M002 | none | S04 implemented FailedTask model with task_id, error_message, file_path, chat_id, context. DLQ alert via send_dlq_alert to TELEGRAM_OWNER_CHAT_ID. Integration test confirms error path. |
| R006 | operability | validated | M002 | none | S02 added telegram-bot service to docker-compose.yml with restart: unless-stopped, volume mounts, and ALLOWED_CHAT_IDS environment variable for authorization. |
| R007 | integration | validated | M003 | none | S05 verification passed: email_notifier.py implements SMTP outbound with aiosmtplib async client. 19 tests covering config validation, email building, async SMTP operations, Russian content. send_clarification_email sends to supplier with BCC to company. Non-blocking pattern matches telegram_notifier. |
| R008 | core-capability | active | M003 | none | S01: InvoiceItem table created with sku, name, qty columns; Invoice.verification_result JSONB column; llm_provider.py wrapper supports OpenAI, Gemini, Claude with automatic fallback. S04: 9 integration tests verify exact SKU matching, RapidFuzz fuzzy name matching (>85% threshold), quantity discrepancy detection. Fuzzy matching logic complete with multi-tier strategy: exact SKU → OK, SKU differs + 85% similarity → clarification, quantity differs → partial. |
| R009 | integration | active | M004 | none | unmapped |
| R010 | admin/support | active | M004 | none | unmapped |
| R011 | primary-user-loop | active | M005 | none | unmapped |
| R012 | core-capability | active | M006 | none | unmapped |
| R013 | core-capability | active | M006 | none | unmapped |
| R014 | operability | active | M006 | none | unmapped |
| R015 | continuity | deferred | none | none | unmapped |
| R016 | quality-attribute | deferred | none | none | unmapped |
| R017 | admin/support | deferred | M005 | none | unmapped |
| R018 | compliance/security | deferred | M005 | none | unmapped |
| R019 | quality-attribute | deferred | none | none | unmapped |

## Coverage Summary

- Active requirements: 8
- Mapped to slices: 8
- Validated: 6 (R001, R002, R004, R005, R006, R007)
- Unmapped active requirements: 0
