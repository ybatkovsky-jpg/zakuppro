# Requirements

This file is the explicit capability and coverage contract for the project.

## Active

### R015 — Graceful shutdown и cleanup для всех сервисов (Celery workers, Telegram bot, FastAPI) с сохранением состояния задач
- Class: continuity
- Status: active
- Description: Graceful shutdown и cleanup для всех сервисов (Celery workers, Telegram bot, FastAPI) с сохранением состояния задач
- Why it matters: Сервисы должны останавливаться корректно, не теряя обрабатываемые задачи.
- Source: inferred
- Primary owning slice: M007 S01
- Validation: S01 delivered: telegram-bot SIGTERM/SIGINT handler + shutdown flag, Celery worker_shutdown signal handler logging active task count, docker-compose.yml stop_grace_period (celery-worker=60s, email-worker=30s, telegram-bot=15s), Docker healthchecks using heartbeat freshness instead of ps aux | grep. Tests: 33 email-worker tests + 13 health endpoint tests + 2 shutdown tests all pass.

### R016 — Health check endpoints для всех сервисов (FastAPI, Celery workers, Telegram bot) для мониторинга статуса
- Class: quality-attribute
- Status: active
- Description: Health check endpoints для всех сервисов (FastAPI, Celery workers, Telegram bot) для мониторинга статуса
- Why it matters: Operational visibility. Нужно знать состояние всех компонентов системы.
- Source: inferred
- Primary owning slice: M007 S01
- Validation: S01 delivered: /health endpoint returns email_worker and telegram_bot status via heartbeat file freshness checks (120s/90s thresholds) on shared Docker volume. All 5 services reported: db, rabbitmq, celery_worker, email_worker, telegram_bot. Tests: 13 health endpoint tests covering all-ok, 4 degradation paths, heartbeat freshness unit tests for both workers.

### R017 — DLQ UI/админка для просмотра и перезапуска неудачных задач с деталями ошибок
- Class: admin/support
- Status: active
- Description: DLQ UI/админка для просмотра и перезапуска неудачных задач с деталями ошибок
- Why it matters: Удобное управление ошибками без запросов к БД или логам.
- Source: inferred
- Primary owning slice: M007 S04

### R018 — Ролевая модель в Web UI: Владелец (видит всё), Менеджер (только свои проекты), Склад (только остатки)
- Class: compliance/security
- Status: active
- Description: Ролевая модель в Web UI: Владелец (видит всё), Менеджер (только свои проекты), Склад (только остатки)
- Why it matters: Безопасность доступа. Разные пользователи должны видеть только свои данные.
- Source: user
- Primary owning slice: M007 S03

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

### R003 — AI-Agent Worker для парсинга Excel файлов с помощью pandas и распознавания структуры таблиц (артикул, название, поставщик) через GPT-4o
- Class: core-capability
- Status: validated
- Description: AI-Agent Worker для парсинга Excel файлов с помощью pandas и распознавания структуры таблиц (артикул, название, поставщик) через GPT-4o
- Why it matters: Автоматизация создания BOM из Excel. LLM нужна для dirty таблиц (объединенные ячейки, многоэтажные шапки).
- Source: user
- Primary owning slice: M002
- Validation: S03 verification passed: Celery task parse_excel_bom registered with @app.task, pandas reads Excel files, OpenAI GPT-4o extracts structure with json_schema, Pydantic validates output. Test file sample_bom.xlsx with Russian headers validates dirty table handling.

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

### R008 — Сверка счетов (Invoice Verification) через LLM с fuzzy matching для опечаток в названиях и артикулах
- Class: core-capability
- Status: validated
- Description: Сверка счетов (Invoice Verification) через LLM с fuzzy matching для опечаток в названиях и артикулах
- Why it matters: Поставщики часто меняют названия. Fuzzy matching + LLM позволяет автоматически сверять счета с заказами.
- Source: user
- Primary owning slice: M003
- Validation: S01: InvoiceItem table created with sku, name, qty columns; Invoice.verification_result JSONB column; llm_provider.py wrapper supports OpenAI, Gemini, Claude with automatic fallback. S04: 9 integration tests verify exact SKU matching, RapidFuzz fuzzy name matching (>85% threshold), quantity discrepancy detection. Fuzzy matching logic complete with multi-tier strategy: exact SKU → OK, SKU differs + 85% similarity → clarification, quantity differs → partial.

### R009 — Bank Worker для загрузки выписки (по API банка или через email) и мапинга платежей к счетам по ИНН и сумме
- Class: integration
- Status: validated
- Description: Bank Worker для загрузки выписки (по API банка или через email) и мапинга платежей к счетам по ИНН и сумме
- Why it matters: Автоматическое сверки财务管理. Платежи должны привязываться к счетам без ручного труда.
- Source: user
- Primary owning slice: M004
- Validation: M004 Complete: S02 1C ClientBank parser with INN extraction (56 tests). S03 Email Worker routes .txt to parse_bank_statement task (29 tests). S04 PaymentMatcher auto-matches by INN + amount ±5% (84 tests). S06 Manual upload fallback (13 tests). Total: 187 tests passing. End-to-end flow verified: manual upload → parsing → auto-matching → manual resolution → audit retrieval.

### R010 — UnresolvedTransaction таблица для платежей которые не удалось привязать автоматически, с UI для ручной сортировки
- Class: admin/support
- Status: validated
- Description: UnresolvedTransaction таблица для платежей которые не удалось привязать автоматически, с UI для ручной сортировки
- Why it matters: Не все платежи маппятся автоматически. Бухгалтер должен иметь возможность разобрать несопоставленные операции.
- Source: user
- Primary owning slice: M004
- Validation: M004 Complete: S04 creates UnresolvedTransaction for unmatched payments. S05 provides full CRUD API with filters/search/bulk operations/audit trail. 55 tests (38 unit + 17 integration) verify manual reconciliation workflow.

### R011 — Frontend UI (Next.js + Ant Design) с Kanban-досками проектов, таблицами спецификаций и экраном комплектации
- Class: primary-user-loop
- Status: validated
- Description: Frontend UI (Next.js + Ant Design) с Kanban-досками проектов, таблицами спецификаций и экраном комплектации
- Why it matters: Менеджерам нужен визуальный интерфейс для управления проектами, статусами и комплектации.
- Source: user
- Primary owning slice: M005
- Validation: S05 verification: docker-compose up -d starts all 7 services (db, api, rabbitmq, email-worker, celery-worker, telegram-bot, frontend). All services show healthy status in docker-compose ps. Smoke test (scripts/smoke-test.sh) validates login → create project → update status → delete workflow. Frontend accessible at http://localhost:3000, backend at http://localhost:8000.
- Notes: S05 completes production readiness: Frontend runs in Docker Compose on port 3000, all 7 services healthy, smoke test validates create → update → delete workflow. Docker deployment documented in README.md.

### R012 — Kanban-логика с блокировками: переход в "Производство" невозможен пока не все позиции "На складе" или "Оплачено"
- Class: core-capability
- Status: validated
- Description: Kanban-логика с блокировками: переход в "Производство" невозможен пока не все позиции "На складе" или "Оплачено"
- Why it matters: Предотвращение ошибок. Нельзя запускать в производство недоукомплектованные проекты.
- Source: user
- Primary owning slice: M006
- Supporting slices: S01
- Notes: Validated by M006 S02. can_transition_to guard blocks transition to В производстве when ProjectItems are not all На складе or Оплачено. S02 delivered 16 tests (11 unit + 5 integration) verifying blocking/allowing/edge cases. HTTP 422 returns item-level breakdown. Guard wired into update_project before write-off (no side effects on blocked transitions). Backend test: `pytest tests/test_transition_service.py -v` — 16 passed, 0 failed. Cross-slice: S01 ProjectStatusHistory model + S02 guard = complete audit trail. Verification evidence: gsd_exec run 2a95123c-21a4-4564-8d0f-5339e2b8b1f5.

### R013 — Резервирование на складе: при создании BOM автоматически резервирует доступные StockItem, списывает при выдаче в производство
- Class: core-capability
- Status: validated
- Description: Резервирование на складе: при создании BOM автоматически резервирует доступные StockItem, списывает при выдаче в производство
- Why it matters: Прозрачность остатков. Менеджеры видят реальные доступные количества, а не общие остатки.
- Source: user
- Primary owning slice: S01
- Validation: S01 delivered stock_service.py with reserve_for_project, write_off_for_production, and receive_stock primitives. Wired auto-reservation into ProjectItem create/update API and Celery BOM task. Wired write-off into project status transition to В производстве. POST /api/stock-items/{id}/receive endpoint with RBAC. Inventory invariant qty_total = qty_reserved + qty_available enforced at service layer with ValueError on violation. 36 tests pass covering all flows including round-trip scenarios.
- Notes: S01 directly implements reserve_for_project, write_off_for_production, and receive_stock. Enforces inventory invariant at service layer. Reservation triggers on ProjectItem create/update and Celery BOM task. Write-off triggers on project status change to В производстве.

### R014 — Матрица готовности проекта: цветовая индикация (Зелёный — всё есть, Жёлтый — часть в пути, Красный — не заказано)
- Class: operability
- Status: validated
- Description: Матрица готовности проекта: цветовая индикация (Зелёный — всё есть, Жёлтый — часть в пути, Красный — не заказано)
- Why it matters: Быстрая оценка комплектации. Менеджер видит статус проекта на одном экране.
- Source: user
- Primary owning slice: M006
- Supporting slices: S01
- Validation: S03 delivered GET /api/projects/readiness endpoint returning per-project green/yellow/red readiness with item counts by procurement stage. Backend computes readiness using PRODUCTION_READY_STATUSES from transition_service: green (all items На складе or Оплачено, or empty), yellow (no К закупке but some in transit: Запрошено or Счет получен), red (any К закупке). Frontend renders colored dots (green/amber/red) on Kanban DraggableProjectCard and Dashboard recent project cards with click-to-expand Popover tooltips showing per-status breakdowns. 12 backend tests verify readiness computation, RBAC (owner/manager), ownership filtering, and edge cases. TypeScript compilation clean.
- Notes: S03 completes the readiness matrix: backend readiness endpoint, frontend visual indicators in both Kanban and Dashboard views. Complete end-to-end flow: DB ProjectItem.status counts → FastAPI endpoint → Next.js proxy → React components with colored indicators.

### R019 — Retry с exponential backoff для всех external calls (OpenAI API, email, bank API)
- Class: quality-attribute
- Status: validated
- Description: Retry с exponential backoff для всех external calls (OpenAI API, email, bank API)
- Why it matters: Надёжность при временных сбоях внешних сервисов.
- Source: inferred
- Primary owning slice: M007 S02
- Validation: S02 delivered: retry_utils.py with retry_sync and retry_async decorators (exponential backoff + jitter). All 6 Telegram functions wrapped with @retry_sync(TelegramError), 2 email functions wrapped with @retry_async(SMTPException). 61 tests pass covering retry count, backoff timing, jitter, non-retryable skip, and max-retry exhaustion. LLM and Celery retry already existed — this closes the final gaps in email/Telegram notification pathways.
- Notes: S02 complete: retry_utils.py provides sync/async decorators matching codebase conventions (max_retries=3, base_delay=1 → delays [1,2,4] with jitter). Returns False on exhaustion (non-critical failure pattern). Logs WARNING per retry attempt, ERROR on exhaustion.

## Deferred

## Out of Scope

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|---|---|---|---|---|---|
| R001 | integration | validated | M002 | none | S02 implemented document handler, authorization middleware (AuthMiddleware with ALLOWED_CHAT_IDS), file persistence, and outbound Telegram notifications via telegram_notifier.py. S02-UAT.md TC1-TC2 verify authorization and access. |
| R002 | core-capability | validated | M002 | none | S01 established RabbitMQ 3-management with DLQ configuration, Celery worker service with health checks. S01-UAT.md verifies RabbitMQ and Celery worker connectivity. |
| R003 | core-capability | validated | M002 | none | S03 verification passed: Celery task parse_excel_bom registered with @app.task, pandas reads Excel files, OpenAI GPT-4o extracts structure with json_schema, Pydantic validates output. Test file sample_bom.xlsx with Russian headers validates dirty table handling. |
| R004 | core-capability | validated | M002 | none | S04 process_bom_to_project orchestrates full flow: Excel from Telegram → AI parsing → Project/ProjectItem DB creation → Telegram notifications. Integration test test_process_bom_to_project_task_success verifies. |
| R005 | failure-visibility | validated | M002 | none | S04 implemented FailedTask model with task_id, error_message, file_path, chat_id, context. DLQ alert via send_dlq_alert to TELEGRAM_OWNER_CHAT_ID. Integration test confirms error path. |
| R006 | operability | validated | M002 | none | S02 added telegram-bot service to docker-compose.yml with restart: unless-stopped, volume mounts, and ALLOWED_CHAT_IDS environment variable for authorization. |
| R007 | integration | validated | M003 | none | S05 verification passed: email_notifier.py implements SMTP outbound with aiosmtplib async client. 19 tests covering config validation, email building, async SMTP operations, Russian content. send_clarification_email sends to supplier with BCC to company. Non-blocking pattern matches telegram_notifier. |
| R008 | core-capability | validated | M003 | none | S01: InvoiceItem table created with sku, name, qty columns; Invoice.verification_result JSONB column; llm_provider.py wrapper supports OpenAI, Gemini, Claude with automatic fallback. S04: 9 integration tests verify exact SKU matching, RapidFuzz fuzzy name matching (>85% threshold), quantity discrepancy detection. Fuzzy matching logic complete with multi-tier strategy: exact SKU → OK, SKU differs + 85% similarity → clarification, quantity differs → partial. |
| R009 | integration | validated | M004 | none | M004 Complete: S02 1C ClientBank parser with INN extraction (56 tests). S03 Email Worker routes .txt to parse_bank_statement task (29 tests). S04 PaymentMatcher auto-matches by INN + amount ±5% (84 tests). S06 Manual upload fallback (13 tests). Total: 187 tests passing. End-to-end flow verified: manual upload → parsing → auto-matching → manual resolution → audit retrieval. |
| R010 | admin/support | validated | M004 | none | M004 Complete: S04 creates UnresolvedTransaction for unmatched payments. S05 provides full CRUD API with filters/search/bulk operations/audit trail. 55 tests (38 unit + 17 integration) verify manual reconciliation workflow. |
| R011 | primary-user-loop | validated | M005 | none | S05 verification: docker-compose up -d starts all 7 services (db, api, rabbitmq, email-worker, celery-worker, telegram-bot, frontend). All services show healthy status in docker-compose ps. Smoke test (scripts/smoke-test.sh) validates login → create project → update status → delete workflow. Frontend accessible at http://localhost:3000, backend at http://localhost:8000. |
| R012 | core-capability | validated | M006 | S01 | unmapped |
| R013 | core-capability | validated | S01 | none | S01 delivered stock_service.py with reserve_for_project, write_off_for_production, and receive_stock primitives. Wired auto-reservation into ProjectItem create/update API and Celery BOM task. Wired write-off into project status transition to В производстве. POST /api/stock-items/{id}/receive endpoint with RBAC. Inventory invariant qty_total = qty_reserved + qty_available enforced at service layer with ValueError on violation. 36 tests pass covering all flows including round-trip scenarios. |
| R014 | operability | validated | M006 | S01 | S03 delivered GET /api/projects/readiness endpoint returning per-project green/yellow/red readiness with item counts by procurement stage. Backend computes readiness using PRODUCTION_READY_STATUSES from transition_service: green (all items На складе or Оплачено, or empty), yellow (no К закупке but some in transit: Запрошено or Счет получен), red (any К закупке). Frontend renders colored dots (green/amber/red) on Kanban DraggableProjectCard and Dashboard recent project cards with click-to-expand Popover tooltips showing per-status breakdowns. 12 backend tests verify readiness computation, RBAC (owner/manager), ownership filtering, and edge cases. TypeScript compilation clean. |
| R015 | continuity | active | M007 S01 | none | S01 delivered: telegram-bot SIGTERM/SIGINT handler + shutdown flag, Celery worker_shutdown signal handler logging active task count, docker-compose.yml stop_grace_period (celery-worker=60s, email-worker=30s, telegram-bot=15s), Docker healthchecks using heartbeat freshness instead of ps aux | grep. Tests: 33 email-worker tests + 13 health endpoint tests + 2 shutdown tests all pass. |
| R016 | quality-attribute | active | M007 S01 | none | S01 delivered: /health endpoint returns email_worker and telegram_bot status via heartbeat file freshness checks (120s/90s thresholds) on shared Docker volume. All 5 services reported: db, rabbitmq, celery_worker, email_worker, telegram_bot. Tests: 13 health endpoint tests covering all-ok, 4 degradation paths, heartbeat freshness unit tests for both workers. |
| R017 | admin/support | active | M007 S04 | none | unmapped |
| R018 | compliance/security | active | M007 S03 | none | unmapped |
| R019 | quality-attribute | validated | M007 S02 | none | S02 delivered: retry_utils.py with retry_sync and retry_async decorators (exponential backoff + jitter). All 6 Telegram functions wrapped with @retry_sync(TelegramError), 2 email functions wrapped with @retry_async(SMTPException). 61 tests pass covering retry count, backoff timing, jitter, non-retryable skip, and max-retry exhaustion. LLM and Celery retry already existed — this closes the final gaps in email/Telegram notification pathways. |

## Coverage Summary

- Active requirements: 4
- Mapped to slices: 4
- Validated: 15 (R001, R002, R003, R004, R005, R006, R007, R008, R009, R010, R011, R012, R013, R014, R019)
- Unmapped active requirements: 0
