---
id: M002
title: "Asynchronous Core + AI-Agent Foundation"
status: complete
completed_at: 2026-06-01T11:43:11.561Z
key_decisions:
  - D001: Modular FastAPI routers per entity for scalability
  - D002: 4 isolated Docker services (fastapi, celery-worker, telegram-bot, rabbitmq)
  - D003: Retry 2x with exponential backoff → DLQ → Telegram alert for LLM errors
  - D004: python-telegram-bot library for Telegram integration
  - D005: RabbitMQ DLQ + DB table for failed task persistence
  - D006: pandas + OpenAI GPT-4o for dirty Excel parsing
  - D011: JSON Schema strict mode for 100% valid AI output
  - D014: python-slugify for safe email generation from Russian names
  - D016: Return bool vs raise exception for Telegram notifier failures
key_files:
  - docker-compose.yml
  - backend/celery_app.py
  - backend/tasks.py
  - backend/routers/health.py
  - backend/handlers/auth.py
  - backend/handlers/documents.py
  - backend/telegram_bot.py
  - backend/excel_parser.py
  - backend/ai_agent.py
  - backend/supplier_resolver.py
  - backend/telegram_notifier.py
  - backend/models.py
  - backend/tests/test_s03_integration.py
  - backend/tests/test_s04_integration.py
  - .env
lessons_learned:
  - OpenAI SDK 1.54+ uses APIResponseValidationError not JSONDecodeError
  - Markdown format better than CSV for GPT-4o table structure understanding
  - Pandas fillna('') prevents confusing NaN markers in AI prompts
  - Exponential backoff countdown=2**retry_count for OpenAI rate limits
  - Supplier resolver returns None for empty names to avoid DB errors
  - Deferred imports inside Celery task try blocks for graceful degradation
  - Worker health check needs 2s timeout to prevent blocking
  - Duplicate filenames handled by Unix timestamp suffix
---

# M002: Asynchronous Core + AI-Agent Foundation

**Implemented RabbitMQ message broker, Celery workers, Telegram Bot service, AI-Agent Excel parser with GPT-4o, end-to-end BOM upload flow, and DLQ persistence**

## What Happened

# Milestone M002 Narrative

## Overview

M002 successfully established the asynchronous processing foundation for ZakupPro. All four slices (S01-S04) were completed with passing verification, enabling the core end-to-end flow: Telegram Excel upload → AI parsing → Project creation → Telegram notification.

## What Was Delivered

### S01: RabbitMQ + Celery Infrastructure
- RabbitMQ 3-management service with persistent volume and management UI
- Celery app configuration with DLQ, JSON serialization, and timezone
- Celery worker service with healthcheck dependency
- Extended /health endpoint checking PostgreSQL, RabbitMQ, and Celery worker status
- Fail-fast health check returning 503 on any service degradation

### S02: Telegram Bot Gateway
- Telegram Bot service (python-telegram-bot v21+) with async handlers
- Authorization middleware via ALLOWED_CHAT_IDS environment variable
- Document upload handler with Excel validation (.xlsx, .xls) and 20MB size limit
- File persistence in Docker volume with duplicate filename handling via timestamp suffix
- Celery task publication for async processing

### S03: Excel Parsing + AI-Agent
- Excel parser module using pandas for dirty invoice table reading
- AI agent module with OpenAI GPT-4o for BOM structure recognition
- JSON Schema strict mode for 100% valid output
- Exponential backoff retry (1s, 2s, 4s) for rate limits
- Pydantic models for output validation

### S04: Project Creation + DLQ
- FailedTask SQLAlchemy model for DLQ context persistence
- Supplier resolver with auto-creation and python-slugify for email generation
- Telegram notifier for completion messages and DLQ alerts
- Main orchestration task chaining Excel parsing, supplier resolution, and Project/ProjectItem creation
- Integration tests confirming end-to-end flow and error path

## Cross-Slice Integration

All 5 explicit boundary contracts were honored:
- S01 → S02, S03, S04: RabbitMQ infrastructure, Celery worker base, health check pattern
- S02 → S04: Telegram Bot service, file persistence, task publication
- S03 → S04: parse_excel_bom task with JSON output for Project creation

## Verification Results

- All 8 success criteria met with evidence in slice summaries and UAT files
- All 4 verification classes (Contract, Integration, Operational, UAT) passed
- Requirements R001-R006 validated and covered
- No blockers, deviations, or known limitations

## Key Technical Decisions

1. Long polling vs webhook for Telegram Bot (simplified deployment)
2. Markdown vs CSV for AI table context (better structure preservation)
3. python-slugify for safe email generation from Russian names
4. Return bool vs raise exception for Telegram notifier failures
5. Deferred imports inside Celery task try blocks for graceful degradation

## Files Modified

- docker-compose.yml: Added rabbitmq, celery-worker, telegram-bot services
- backend/celery_app.py: New Celery configuration with DLQ
- backend/tasks.py: Celery tasks for health check, Excel parsing, orchestration
- backend/routers/health.py: Extended with RabbitMQ and Celery worker checks
- backend/handlers/: Authorization, commands, and document upload handlers
- backend/telegram_bot.py: Bot entry point and application builder
- backend/excel_parser.py: Pandas-based Excel reading utilities
- backend/ai_agent.py: GPT-4o integration for BOM extraction
- backend/supplier_resolver.py: Supplier lookup and auto-creation
- backend/telegram_notifier.py: Outbound notification helper
- backend/models.py: FailedTask model added
- backend/tests/: Integration tests for S03 and S04
- .env: Added CELERY_BROKER_URL, TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_IDS

## Success Criteria Results

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Владелец может загрузить Excel через Telegram и получить Project в БД | ✅ PASS | S04-SUMMARY.md: `process_bom_to_project` Celery task orchestrates full flow. S04-UAT.md TC01 defines end-to-end test. |
| 2 | Telegram Bot авторизует по chat_id из .env | ✅ PASS | S02-SUMMARY.md: `AuthMiddleware` class loads `ALLOWED_CHAT_IDS` from environment. S02-UAT.md TC1-TC2 verify authorization. |
| 3 | RabbitMQ + Celery обрабатывают задачи асинхронно | ✅ PASS | S01-SUMMARY.md: RabbitMQ 3-management, Celery app with @app.task registration, docker-compose.yml shows celery-worker service. |
| 4 | OpenAI GPT-4o распознаёт dirty Excel структуры | ✅ PASS | S03-SUMMARY.md: `extract_bom_structure()` uses gpt-4o with response_format=json_schema. Russian column mapping in system prompt. |
| 5 | DLQ сохраняет контекст ошибок | ✅ PASS | S04-SUMMARY.md: FailedTask SQLAlchemy model with task_id, error_message, file_path, chat_id, context (JSON). S04-UAT.md TC02 verifies DLQ. |
| 6 | Telegram alerts отправляются при проблемах | ✅ PASS | backend/telegram_notifier.py: `send_dlq_alert()` sends formatted message to TELEGRAM_OWNER_CHAT_ID. |
| 7 | Health check показывает статус всех сервисов | ✅ PASS | backend/routers/health.py: /health checks PostgreSQL, RabbitMQ, Celery worker. Returns 503 when degraded. |
| 8 | Сервисы изолированы в Docker (падение worker не останавливает bot) | ✅ PASS | docker-compose.yml: Separate services on zakuppro-network. celery-worker depends_on rabbitmq with healthcheck. |

## Definition of Done Results

| Item | Status | Evidence |
|-------|--------|----------|
| All slices complete | ✅ PASS | S01, S02, S03, S04 all have status complete with all tasks done. |
| All SUMMARY.md artifacts present | ✅ PASS | S01-SUMMARY.md, S02-SUMMARY.md, S03-SUMMARY.md, S04-SUMMARY.md all present with passing verification. |
| All cross-slice integrations honored | ✅ PASS | All 5 boundary contracts (S01→S02/S03/S04, S02→S04, S03→S04) verified honored. |
| All verification classes passed | ✅ PASS | Contract, Integration, Operational, UAT all have passing evidence. |
| No blockers or deviations | ✅ PASS | All slices report no blockers, deviations, or known limitations. |

## Requirement Outcomes

| Requirement | Status | Evidence |
|-------------|--------|----------|
| R001 — Telegram Bot for Excel uploads | VALIDATED | S02 implemented document handler, AuthMiddleware with ALLOWED_CHAT_IDS, file persistence, telegram_notifier.py |
| R002 — RabbitMQ + Celery async processing | VALIDATED | S01 established RabbitMQ 3-management, Celery worker with health checks |
| R003 — AI-Agent Excel parsing with GPT-4o | VALIDATED | S03 parse_excel_bom task with pandas Excel reading, OpenAI GPT-4o extraction |
| R004 — Flow 1: Upload → Parse → DB → Response | VALIDATED | S04 process_bom_to_project orchestrates full flow; integration test verifies |
| R005 — DLQ with context persistence | VALIDATED | S04 FailedTask model with context, DLQ alert via send_dlq_alert |
| R006 — Telegram Bot as Docker service | VALIDATED | S02 telegram-bot service in docker-compose.yml with restart policy and ALLOWED_CHAT_IDS |

## Deviations

None.

## Follow-ups

None.
