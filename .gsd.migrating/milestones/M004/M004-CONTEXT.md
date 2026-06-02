# M004: Bank Integration + Financials

**Gathered:** 2026-06-02
**Status:** Ready for planning

## Project Description

M004 реализует автоматическую загрузку банковских выписок и сопоставление платежей со счетами. Выписки приходят от банков Тинькофф и Озон в формате 1С ClientBank (.txt) через email. Система автоматически распознаёт тип письма (выписка или счёт), парсит выписку, и выполняет мапинг платежей на счета по ИНН поставщика. Платежи, которые не удалось сопоставить автоматически, попадают в интерфейс ручной сортировки для бухгалтера.

## Why This Milestone

M001-M003 создали фундамент: базу данных, API, Telegram bot, Email Worker для счётов, и DLQ инфраструктуру. M004 добавляет критический финансовый контур:

- **Безопасность:** Выписки из банка подтверждают реальные платежи — система может детектировать расхождения между счётами и оплатой
- **Экономия времени:** Авто-мап по ИНН исключает ручную сортировку для большинства платежей
- **Audit trail:** История изменений привязок позволяет отслеживать кто и когда сопоставил транзакцию

Это второй "живой" flow после M002, но с фокусом на бухгалтерию и финансовую свёрстку.

## User-Visible Outcome

### When this milestone is complete, the user can:

1. **Получать выписки автоматически:** Банк отправляет выписку на email → Email Worker детектирует тип → выписка парсится и загружается в БД
2. **Вручную загрузить выписку:** Загрузить .txt файл через UI (fallback если email не пришёл или был потерян)
3. **Видеть автоматически сопоставленные платежи:** Транзакции с ИНН поставщика + сумма ±5% + дата в диапазоне срока оплаты → привязаны к счету
4. **Сортировать unresolved вручную:** UI со списком несопоставленных транзакций, фильтрами, поиском, bulk операциями
5. **Просматривать историю изменений:** Видеть кто/когда/что привязал, с возможностью отката
6. **Аналитika:** Дашборд с оплачено/неоплачено, динамикой платежей, экспортом в Excel

### Entry point / environment

- Entry point: Email Worker (IMAP polling) + UI upload endpoint
- Environment: local dev (Docker Compose: fastapi, celery-worker, rabbitmq, postgres)
- Live dependencies involved: IMAP mailbox, Telegram Bot (только для ошибок), RabbitMQ, PostgreSQL

## Completion Class

- Contract complete means: Выписка 1С ClientBank парсится корректно для Тинькофф и Озон банк, авто-мап работает по ИНН + сумма ±5% + даты, unresolved UI поддерживает фильтры, поиск, bulk, комментарии, audit log
- Integration complete means: Выписка из email → Celery task → парсинг → BankStatement + BankTransaction в БД → авто-мап на Invoice → результат в UI
- Operational complete means: Ошибка парсинга → DLQ → Telegram alert владельцу; manually uploaded файл обрабатывается через тот же flow

## Final Integrated Acceptance

To call this milestone complete, we must prove:

1. **Full Flow (email):** Выписка Тинькофф/Озон с email → детекция типа → парсинг 1С ClientBank → BankStatement + BankTransaction в БД → авто-мап на Invoice по ИНН → результат в UI
2. **Full Flow (manual upload):** Загрузка .txt через UI → парсинг → тот же outcome
3. **Auto-mapping accuracy:** Платёж с ИНН поставщика + сумма в диапазоне ±5% + дата в диапазоне срока оплаты счета → автоматически привязан
4. **Unresolved UI:** Список unresolved транзакций с фильтрами (банк, контрагент, дата, сумма), поиском (ИНН, сумма, дата), bulk привязкой, комментариями
5. **Audit history:** Привязка отображается в `transaction_matching_audit` с user_id, timestamp, action; откат через UI работает
6. **Error path:** Невалидный формат выписки → retry 2x → DLQ → Telegram alert владельцу
7. **Аналитика:** Дашборд показывает оплачено/неоплачено, динамику платежей; экспорт в Excel работает

## Architectural Decisions

### Email Type Detection Strategy

**Decision:** Email Worker расширяется для детекции типа письма по attachment filename, subject pattern, и sender domain

**Rationale:**
- Формат 1С ClientBank (.txt) отличается от PDF/Excel счетов
- Subject для выписок обычно содержит "Выписка" / "Statement" / "Bank statement"
- Sender domain для банков известен (tinkoff.ru, ozon.ru)
- Детекция позволяет route'ить в правильный Celery task (parse_invoice vs parse_bank_statement)

**Alternatives Considered:**
- Отдельный mailbox для выписок — требует настройки второго IMAP account, усложняет инфраструктуру
- LLM для классификации — overkill, достаточно эвристик
- Ручной выбор типа через UI — не работает для email ingest

### Bank Statement Parser Architecture

**Decision:** Отдельный Celery task `parse_bank_statement` с парсером 1С ClientBank формата

**Rationale:**
- 1С ClientBank — стандартизированный формат с секциями (СекцияДокумент, СекцияСчет)
- Парсер детектит банк по содержимому (поля специфичны для Тинькофф/Озон)
- Выписка сохраняется в БД как BLOB (BYTEA), аналогично Invoice.raw_file
- Отдельная задача позволяет independent retry и DLQ

**Alternatives Considered:**
-Reuse InvoiceProcessor — слишком разные форматы, хуже читаемость кода
- Синхронная обработка в Email Worker — блокирует polling, нарушает архитектуру M002

### RabbitMQ Exchange Structure

**Decision:** Новый exchange `bank.statement` с routing key "bank.statement.received", DLQ для failed парсинга

**Rationale:**
- Чистое разделение доменов: invoice vs bank statement
- Легче мониторить и отлаживать (отдельные queue, metrics)
- DLQ из коробки через RabbitMQ policy

**Alternatives Considered:**
- Существующий email.raw_data exchange — смешивает домены, сложнее фильтровать
- Без RabbitMQ (синхронно) — блокирует polling, нет retry logic

### Auto-Matching Strategy

**Decision:** Авто-мап по ИНН поставщика + сумма ±5% + диапазон дат (создание счета + срок оплаты)

**Rationale:**
- ИНН — уникальный идентификатор поставщика в России
- Сумма с допуск ±5% учитывает частичную оплату или округления
- Диапазон дат (создание счета → срок оплаты) исключает ложные срабатывания на старые счета
- Платежи без ИНН → UnresolvedTransaction (только ручная сортировка)

**Alternatives Considered:**
- LLM для fuzzy matching — исключено (user confirmed)
- Только по сумме — слишком много false positives
- Строгое совпадение суммы — частичные оплаты не детектируются

### UnresolvedTransaction UI Scope

**Decision:** Полноценный UI для бухгалтерии с фильтрами, поиском, bulk операциями, комментариями, audit history, аналитикой, Excel export

**Rationale:**
- Бухгалтерия требует мощный инструмент для сортировки
- Bulk операции критичны для большого количества транзакций
- Комментарии позволяют документировать решения
- Audit history нужен для compliance и отката
- Аналитика и экспорт — стандартные требования accounting

**Alternatives Considered:**
- Только API + таблица в БД — недостаточно для M004, откладывает UI
- Минимальный inline UI — не решает реальный use case бухгалтера

### Audit History Storage

**Decision:** Отдельная таблица `transaction_matching_audit` с полями: transaction_id, invoice_id, user_id, action (matched/unmatched), timestamp, comment

**Rationale:**
- История всех перепривязок (non-destructive)
- Возможность отката через UI
- Отдельная сущность для чистой архитектуры
- Расширяемо для других сущностей (будущие milestones)

**Alternatives Considered:**
- Поля в Transaction — не хранит историю перепривязок
- Generic AuditLog mixin — overkill для M004, можно рефакторить позже

### Telegram Notification Scope

**Decision:** Telegram alerts только для ошибок (выписка не получена, не загружена, загружена с ошибкой)

**Rationale:**
- Успешная обработка не требует уведомления (шум)
- Owner должен знать о проблемах с финансовыми данными
- Reuse существующего telegram_notifier.py из M003

**Alternatives Considered:**
- Уведомления о каждой выписке — слишком много шума
- Никаких уведомлений — потеря visibility на проблемы

## Error Handling Strategy

### Component Failures

| Component | Failure Mode | Handling |
|-----------|---------------|----------|
| IMAP connection | Down | Email Worker retry с exponential backoff (как в M003) |
| 1С ClientBank parsing | Invalid format | Retry 2x → DLQ → Telegram alert |
| Bank detection | Unknown bank format | DLQ с контекстом → Telegram alert |
| Auto-matching | DB error | Celery task retry → DLQ при exhausted retries |
| Manual upload | Invalid file | 400 error пользователю с описанием |
| RabbitMQ | Down | Email Worker возвращает ошибку, задача не публикуется |

### Retry Policy

- **Bank statement parsing:** 2 retries, exponential backoff (1s, 5s)
- **Database operations:** SQLAlchemy retry on connection errors
- **Auto-matching:** Не retry'ется (детерминированно упадёт или сработает)

### Dead Letter Queue

- Задачи после исчерпания retry попадают в DLQ
- Сохраняется: task_id, error message, bank statement content, parsing context
- Telegram alert отправляется владельцу с task_id

### User-Facing Errors

| Scenario | User sees |
|----------|-----------|
| Выписка получена и распарсена | Ничего (silent success, видно в UI) |
| Auto-mapped successfully | Транзакция привязана в UI (зеленый индикатор) |
| Parsing failed | "Выписка не удалась. Задача #{id} в очереди ошибок." (Telegram) |
| Manual upload failed | "Неверный формат файла. Ожидается 1С ClientBank (.txt)" |
| Service down | "Сервис временно недоступен. Попробуйте позже." |

## Risks and Unknowns

| Risk/Unknown | Why it matters | Mitigation |
|--------------|----------------|------------|
| **1С ClientBank format variations** | Банки могут менять формат, нарушая парсер | Тестовые fixtures для Тинькофф и Озон, fallback в DLQ |
| **Email type detection false positives** | Счёт может быть детектирован как выписка (или наоборот) | Multi-layer проверка: filename + subject + sender |
| **Auto-mapping false positives** | Неправильная привязка создаёт финансовые расхождения | Strict критерии (ИНН + сумма + даты), manual review в UI |
| **Performance bulk operations** | Большое количество unresolved транзакций может тормозить UI | Pagination, lazy loading, batch size limits |
| **Audit history size** | Много изменений может раздуть таблицу | Partitioning по timestamp (future milestone) |

## Existing Codebase / Prior Art

| File/Module | How it relates |
|-------------|----------------|
| `backend/email_worker.py` | Reuse IMAP polling, processed Message-ID tracking, task publishing |
| `backend/tasks.py` | Добавить `parse_bank_statement` task, reuse DLQ pattern |
| `backend/models.py` | Использует Invoice, Supplier модели. Добавить BankStatement, BankTransaction, TransactionMatchingAudit |
| `backend/telegram_notifier.py` | Reuse для error alerts (не для успешных выписок) |
| `backend/services/imap_client.py` | Reuse для IMAP connection и attachment extraction |
| `docker-compose.yml` | Добавить bank.statement exchange configuration |

## Relevant Requirements

- **R006** — Выписки из банка (1С ClientBank format, Тинькофф/Озон)
- **R007** — Авто-мап платежей по ИНН + сумма ±5% + даты
- **R008** — UnresolvedTransaction UI (фильтры, поиск, bulk, комментарии)
- **R009** — Audit history (transaction_matching_audit)
- **R010** — Аналитика (оплачено/неоплачено, динамика платежей, Excel export)
- **R011** — Manual upload endpoint (fallback)
- **R012** — Telegram alerts только для ошибок

## Scope

### In Scope

- **Email Worker extension:** Детекция типа письма (invoice vs bank statement) по attachment, subject, sender
- **Bank statement parsing:** 1С ClientBank format parser для Тинькофф и Озон банк
- **New RabbitMQ exchange:** `bank.statement` с routing keys и DLQ
- **Database models:** BankStatement, BankTransaction, TransactionMatching, TransactionMatchingAudit
- **Auto-matching logic:** По ИНН поставщика + сумма ±5% + диапазон дат
- **Manual upload endpoint:** POST /api/bank-statements/upload для .txt файлов
- **Unresolved UI:** Список unresolved транзакций с фильтрами, поиском, bulk привязкой, комментариями
- **Audit history:** Таблица transaction_matching_audit с UI для просмотра и отката
- **Аналитика dashboard:** Оплачено/неоплачено, динамика платежей, графики
- **Excel export:** Экспорт unresolved transactions и audit history
- **Telegram error alerts:** Parse failures, DLQ events
- **Tests:** Unit tests для 1С parser, integration tests для flow, e2e test для email → DB

### Out of Scope / Non-Goals

- Web dashboard UI (M005) — M004 строит только API для accounting frontend
- Ручной UI для счётов (M005) — M004 фокусируется на транзакциях
- Автоматическая оплата через банк API (future milestone)
- ML/AI для fuzzy matching (excluded by user decision)
-_multi-bank support beyond Тинькофф/Озон (future milestone)
- Reconciliation reports (M005 analytics)

## Technical Constraints

- Python 3.14+ (existing)
- FastAPI (existing)
- SQLAlchemy 2.0 (existing)
- PostgreSQL (existing)
- RabbitMQ (existing from M002)
- 1С ClientBank format specification
- IMAP mailbox (existing from M003)

## Integration Points

| System/Service | Interaction |
|----------------|-------------|
| **IMAP mailbox** | Polling для писем с выписками (reuse Email Worker) |
| **RabbitMQ** | New exchange `bank.statement` для parsing tasks |
| **PostgreSQL** | Хранение BankStatement, BankTransaction, TransactionMatchingAudit |
| **Telegram Bot** | Error alerts (не успешные выписки) |
| **Invoice model** | Auto-mapping BankTransaction → Invoice по supplier INN |

## Testing Requirements

- Unit tests для 1С ClientBank parser (Тинькофф и Озон fixtures)
- Unit tests для auto-matching logic (ИНН + сумма ±5% + даты)
- Integration tests для parse_bank_statement Celery task
- Integration tests для manual upload endpoint
- E2E test: Email с выпиской → parsing → auto-mapping → результат в UI
- E2E test: Manual upload → parsing → auto-mapping → результат
- DLQ scenario test: Invalid format → retry → DLQ → Telegram alert
- UI tests (если есть frontend): Фильтры, поиск, bulk operations

## Acceptance Criteria

- Email Worker детектирует выписку от счёта по attachment/subject/sender
- parse_bank_statement Celery task парсит 1С ClientBank format
- BankStatement и BankTransaction создаются в БД с корректными полями
- Оригинальный файл выписки сохраняется в BankStatement.raw_file (BYTEA)
- Auto-matching срабатывает для платежей с ИНН поставщика + сумма ±5% + даты в диапазоне
- UnresolvedTransaction создаётся для непривязанных платежей
- Manual upload endpoint принимает .txt файлы и возвращают BankStatement
- Unresolved UI поддерживает фильтры (банк, контрагент, дата, сумма)
- Unresolved UI поддерживает поиск (ИНН, сумма, дата)
- Unresolved UI поддерживает bulk привязку к счетам
- Комментарии сохраняются к привязкам
- Audit history показывает все изменения с user_id и timestamp
- Откат через UI работает (undo last match)
- Аналитика dashboard показывает оплачено/неоплачено, динамику платежей
- Excel export работает для unresolved transactions и audit history
- Telegram alert отправляется при parse failure
- DLQ содержит контекст ошибки для debugging
- Health check включает bank statement parsing status

## Open Questions

None resolved. All scope questions answered during discussion.
