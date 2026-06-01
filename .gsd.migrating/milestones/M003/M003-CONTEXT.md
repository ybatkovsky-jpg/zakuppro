# M003: Email + Invoice Processing

**Gathered:** 2026-06-01
**Status:** Ready for planning

## Project Description

Система автоматической обработки входящих счетов от поставщиков через IMAP с верификацией против отправленных запросов и умным сопоставлением товаров.

## Why This Milestone

Закрыть цикл: спецификация → проект → запросы поставщикам → счёта → верификация. Автоматизировать ручной labour и ошибки при обработке счетов. Поставщики шлют счёты на отдельный почтовый ящик → система парсит, сверяет с заказами и уведомляет о результатах.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Отправить спецификацию в Telegram или на email и ответить на интерактивные вопросы системы для создания проекта
- Получить уведомление в Telegram о результатах обработки счёта (успех/частичный успех/ошибка) с деталями расхождений
- Просмотреть в базе сохранённые оригинальные файлы счётов, извлечённые данные и результаты верификации

### Entry point / environment

- Entry point: Telegram bot, Email inbox, Celery worker, REST API
- Environment: Docker compose (fastapi, celery-worker, telegram-bot, email-worker, rabbitmq)
- Live dependencies involved: Telegram Bot API, IMAP/SMTP сервера, OpenAI/Gemini/Claude API, SQLite/PostgreSQL

## Completion Class

- Contract complete means: Все модули покрываются тестами, IMAP ingest успешно парсит тестовые PDF/Excel файлы, verify логика корректно сопоставляет позиции по артикулу/наименованию
- Integration complete means: IMAP ingest → parse → verify → store → notify поток работает end-to-end с реальными email сообщениями и LLM API
- Operational complete means: Retry logic (3 attempts) работает, fallback на альтернативные LLM провайдеры функционирует, BLOB storage не переполняет БД при реальном объёме файлов

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Спецификация получена в Telegram → бот задаёт вопросы → пользователь отвечает → проект создан → запросы отправлены поставщикам
- Поставщик присылает счёт на email → система парсит PDF/Excel → сверяет с запросом → сохраняет файл и данные → уведомляет в Telegram
- Артикул differs но наименование похоже → система запрашивает clarification у поставщика → получает подтверждение → сохраняет variation alias → уведомляет владельца
- LLM провайдер fallback работает при сбое primary API

## Architectural Decisions

### IMAP Ingestion Strategy

**Decision:** Auto-poll отдельного почтового ящика (invoices@company.com) с гибким интервалом и триггером на новое письмо.

**Rationale:** Поставщики присылают только счёта в ответ на отправленные запросы. 1 письмо = 1 поставщик = 1 счёт. Гибкий интервал позволяет балансировать между real-time обработкой и нагрузкой.

**Alternatives Considered:**
- Manual Telegram forwarding — добавляет ручной труд, не масштабируется
- API-only upload — не покрывает основной канал от поставщиков

### File Storage Strategy

**Decision:** Хранить оригинальные файлы как BLOB в SQLite + извлечённые структурированные данные.

**Rationale:** Аудитная следа требует оригиналов файлов. Перепарсинг при изменении логики невозможен без оригиналов. Юридическая защита требует доступа к оригинальным документам.

**Alternatives Considered:**
- Извлечённые данные только — теряется оригинал, невозможно перепарсить
- Файловая система — усложняет бэкап и синхронизацию
- S3 — зависит от внешнего сервиса

### LLM Provider Strategy

**Decision:** Провайдер-агностик wrapper с переключаемым выбором через конфигурацию и fallback механизмом.

**Rationale:** Разные провайдеры имеют разные цены и качество. GPT-4o-mini дешевле GPT-4o, Gemini 2.5 Flash ещё дешевле. Fallback позволяет продолжить работу при сбое primary API.

**Alternatives Considered:**
- Только OpenAI GPT-4o — дорогое решение, single point of failure
- Local LLM — требует GPU и дополнительную настройку

### Verification Logic with Smart Matching

**Decision:** Сверка позиций по артикулу и наименованию с clarification flow при расхождениях.

**Rationale:** Артикул совпадает → OK (игнорируем небольшие расхождения в наименованиях). Артикул differs + наименование похоже → запросить clarification у поставщика. Подтверждение → зафиксировать variation alias в БД + уведомить владельца.

**Alternatives Considered:**
- Строгое совпадение по всем полям — много false positives из-за вариантов наименований
- Только наименование — недостаточно надёжно

### Interactive Data Collection Channel

**Decision:** Канал интерактивного сбора данных соответствует источнику спецификации: Telegram → Telegram, Email → Email.

**Rationale:** Пользователь уже использует канал для отправки спецификации. Ответ в том же канале улучшает UX и снижает friction.

**Alternatives Considered:**
- Только Telegram — не покрывает email пользователей
- Только email — не покрывает Telegram пользователей

## Error Handling Strategy

**LLM Parsing:**
- Максимум 3 попытки парсинга с exponential backoff
- Fallback на альтернативные LLM провайдеры при сбое primary
- Сохранять что удалось спарсить + оригинальный файл для ручной обработки
- Telegram alert при невозможности распарсить

**Verification:**
- Артикул совпадает → OK (игнорируем небольшие расхождения наименований)
- Артикул differs + наименование похоже → clarification flow с поставщиком
- Количество differs, лишние позиции, пропущенные позиции → флагать в результатах
- Partial success сохраняется с деталями проблем

**Email Ingest:**
- IMAP connection errors → retry с backoff
- Неподдерживаемый формат → alert + сохранение файла для ручного разбора
- Дубликаты (по message-id) → игнорировать

## Risks and Unknowns

- **LLM cost при retry** — ограничено 3 попытками + fallback на более дешёвые модели
- **Размер базы при BLOB хранении** — SQLite может переполниться при большом объёме файлов;可以考虑 миграцию на PostgreSQL later
- **Clarification flow с поставщиками** — новый интерактивный канал, требует проектирования UX
- **Dirty Excel таблицы** — объединённые ячейки, многоэтажные шапки, inconsistent Russian column names

## Existing Codebase / Prior Art

- `app/models/` — SQLAlchemy 2.0 модели (Project, BomLineItem, Supplier) с relationship(back_populates=...) и lazy="selectin"
- `app/tasks.py` — Celery tasks для парсинга Excel спецификаций через pandas + OpenAI GPT-4o
- `app/routers/` — FastAPI routers с modular структурой
- `app/services/telegram_notifier.py` — Telegram notifications через python-telegram-bot
- `docker-compose.yml` — 4 Docker сервиса: fastapi, celery-worker, telegram-bot, rabbitmq; нужно добавить email-worker
- `.env` — конфигурация для IMAP/SMTP, LLM API keys

## Relevant Requirements

- **R001** — Автоматическая обработка входящих документов от поставщиков
- **R002** — Верификация счетов против отправленных запросов
- **R003** — Уведомления о результатах обработки в Telegram
- **R004** — Хранение оригинальных файлов для аудита

## Scope

### In Scope

- Интерактивный сбор данных при создании проекта (номер проекта, название, сумма, адрес, заказчик, телефон, комментарии)
- IMAP ingest отдельного почтового ящика для счетов
- Parse PDF/Excel файлов через pandas + LLM с провайдер-агностик wrapper
- Verify логика с умным сопоставлением по артикулу/наименованию и clarification flow
- Store оригинальных файлов (BLOB) + извлечённых данных + результатов верификации + variation aliases
- Telegram уведомления о результатах обработки
- LLM provider fallback mechanism
- Новый Docker сервис: email-worker

### Out of Scope / Non-Goals

- Отправка запросов поставщикам через email — предполагается уже реализована или делается вручную
- Approval workflow для счетов — только верификация и уведомления
- Множественные поставщики в одном письме — 1 письмо = 1 поставщик = 1 счёт
- PDF generation для отправки запросов — не в scope этого milestone

## Technical Constraints

- SQLAlchemy 2.0 с relationship(back_populates=...) для bidirectional relationships
- Pydantic v2 с model_config = ConfigDict(from_attributes=True) для ORM mode
- Celery с RabbitMQ для background tasks
- Python 3.12+ runtime
- SQLite для development (может быть заменён на PostgreSQL для production)

## Integration Points

- **IMAP сервер** — опрос отдельного почтового ящика для входящих счетов
- **SMTP сервер** — отправка ответных писем с вопросами при уточнении данных
- **Telegram Bot API** — интерактивный сбор данных + уведомления о результатах
- **LLM APIs** — OpenAI GPT-4o/GPT-4o-mini, Gemini 2.5 Flash, Claude Sonnet 4.5 (переключаемые)
- **RabbitMQ** — task queue для email-worker и celery-worker
- **Существующая БД** — Projects, BomLineItems, Suppliers для сверки

## Testing Requirements

- Unit тесты для verify логики (сопоставление по артикулу/наименованию)
- Integration тесты для IMAP ingest с тестовым mailbox
- LLM mock для парсинга тестовых PDF/Excel файлов
- Test fixtures для dirty Excel таблиц (merged cells, multi-line headers)
- Coverage >80% для новых модулей

> Test scenarios:
> - успешный parse и verify для корректного счёта
> - clarification flow при артикул differs + похожее наименование
> - partial success при quantity differs, лишние/пропущенные позиции
> - LLM fallback при сбое primary API
> - interactive data collection через Telegram и Email

## Acceptance Criteria

- [ ] Интерактивный сбор данных работает в Telegram и Email
- [ ] IMAP ingest успешно обрабатывает входящие письма с вложениями
- [ ] Parse успешно извлекает данные из PDF и Excel файлов
- [ ] Verify корректно сопоставляет позиции и флагает расхождения
- [ ] Variation aliases сохраняются в БД после clarification
- [ ] Telegram уведомления отправляются для всех исходов
- [ ] LLM fallback работает при сбое primary API
- [ ] BLOB storage корректно сохраняет и извлекает файлы
- [ ] Email-worker интегрирован в docker-compose.yml
- [ ] Все тесты проходят

## Open Questions

Нет открытых вопросов. Контекст готов для планирования.
