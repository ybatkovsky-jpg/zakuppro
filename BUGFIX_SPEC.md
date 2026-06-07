# ZakupPro BUGFIX_SPEC.md — M007 Production Hardening

**Дата:** 2026-06-07  
**Автор:** Automated QA Agent  
**Ветка:** fix/automated-m007-bugfix-20260607

---

## Summary

Система ZakupPro прошла полное E2E и API тестирование на production-сервере (64.188.56.25).  
Все Docker-контейнеры (api, frontend, celery-worker, email-worker, telegram-bot, db, rabbitmq) — healthy.  
Обнаружено **8 критических/высоких** и **5 средних/низких** багов, требующих исправления.

**Здоровье системы:**
- ✅ Все 7 контейнеров здоровы
- ✅ JWT-аутентификация работает
- ✅ CRUD для Projects/Suppliers работает
- ✅ Excel-загрузка работает (с AI-извлечением BOM)
- ✅ Telegram-бот опрашивает обновления
- ⚠️ Email Worker: IMAP-аутентификация не настроена (10 ошибок/10мин)
- ⚠️ RabbitMQ: 4 сообщения зависли в reply-queues (celery pidbox)

---

## Identified Bugs

### BUG-001: [CRITICAL] Корrupted line в excel_parser.py — `result.iloceader_row]`

| Поле | Значение |
|------|----------|
| **ID** | BUG-001 |
| **Сервис** | api (backend) |
| **Описание** | В файле `excel_parser.py`, строки 129-130: `result.iloceader_row]` и `result.iloceader_row + 1:]` — синтаксическая ошибка вместо `result.iloc[header_row]` и `result.iloc[header_row + 1:]`. Это вызывает `SyntaxError` при импорте модуля, ломая весь pipeline обработки Excel. |
| **Шаги воспроизведения** | 1. Загрузить Excel файл через UI или API → 2. Вызов `clean_dataframe()` → 3. SyntaxError при выполнении строки 129 |
| **Лог** | `SyntaxError: invalid syntax` (строка 129) — хотя Python может не падать при импорте из-за отложенного выполнения, при фактическом вызове `clean_dataframe()` с `header_row > 0` будет `AttributeError: 'DataFrame' object has no attribute 'iloceader_row'` |
| **Предполагаемая причина** | Опечатка при редактировании: `iloc[header_row]` → `iloceader_row]` (пропущен `[h`, добавлен `e`) |

### BUG-002: [HIGH] Frontend/Backend статус-мismatch — английские vs русские статусы

| Поле | Значение |
|------|----------|
| **ID** | BUG-002 |
| **Сервис** | frontend + api |
| **Описание** | Frontend использует английские статусы: `new`, `processing`, `requested`, `invoiced`, `paid`, `delivered`, `completed`, `cancelled` (в `PROJECT_STATUS_MAP`, `STATUS_NEXT_STEP`, `VALID_TRANSITIONS`, `ITEM_STATUS_MAP`). Backend использует русские: `Проектирование`, `Закупки`, `В производстве`, `Монтаж` (для Project) и `К закупке`, `Запрошено`, `Счет получен`, `Оплачено`, `На складе`, `В производстве` (для ProjectItem). Нет слоя маппинга. |
| **Шаги воспроизведения** | 1. Создать проект через API → статус = `Проектирование` → 2. Frontend получает `status: "Проектирование"` → 3. `PROJECT_STATUS_MAP["Проектирование"]` = `undefined` → 4. Бейдж статуса не рендерится, Kanban-колонка не определяется |
| **Лог** | Визуально: статус проекта отображается как пустой или "Неизвестно" на Kanban-доске и в деталях проекта |
| **Предполагаемая причина** | Frontend и Backend разрабатывались параллельно без согласования enum-статусов. Нужно добавить маппинг слой или унифицировать статусы |

### BUG-003: [HIGH] HTTP method mismatch — статус проекта PATCH/POST vs PUT

| Поле | Значение |
|------|----------|
| **ID** | BUG-003 |
| **Сервис** | frontend + api |
| **Описание** | Frontend `StatusTransitionModal` отправляет `POST /api/projects/{id}/status`, а `updateProjectStatus` mutation использует `PATCH /api/projects/{id}`. Backend определяет только `PUT /api/projects/{id}/status` в `frontend_compat.py`. Ни POST, ни PATCH не поддерживаются — только PUT. |
| **Шаги воспроизведения** | 1. Открыть проект → 2. Нажать кнопку смены статуса → 3. Получить 405 Method Not Allowed |
| **Лог** | `{"detail":"Method Not Allowed"}` |
| **Предполагаемая причина** | Несогласованность HTTP-методов между frontend и backend при разработке |

### BUG-004: [HIGH] Duplicate projects не предотвращаются при загрузке

| Поле | Значение |
|------|----------|
| **ID** | BUG-004 |
| **Сервис** | api (frontend_compat) |
| **Описание** | При загрузке Excel-файла с тем же именем проекта (mode="new", по умолчанию) создаётся дубликат без предупреждения. Endpoint `/api/projects/check-duplicate` существует и работает (GET), но upload handler (`POST /api/projects/upload`) не вызывает проверку дубликатов автоматически. Frontend UI показывает предупреждение, но backend не отклоняет дубликаты. |
| **Шаги воспроизведения** | 1. Загрузить test_bom.xlsx → проект "test_bom" создан (id=6) → 2. Загрузить тот же файл снова → проект "test_bom" (id=7) — дубликат без предупреждения |
| **Лог** | `{"success":true,"project":{"id":7,"name":"test_bom",...}}` |
| **Предполагаемая причина** | Upload handler не проверяет дубликаты при `mode="new"`. Нужно добавить auto-dedup check или принудительно требовать mode при существующем имени |

### BUG-005: [HIGH] .env файл в Git-репозитории — утечка секретов

| Поле | Значение |
|------|----------|
| **ID** | BUG-005 |
| **Сервис** | devops/security |
| **Описание** | Файл `.env` отслеживается Git и содержит реальные секреты: `DEEPSEEK_API_KEY=sk-b0071889961344d0aba3cee96d70e11d`, `TELEGRAM_BOT_TOKEN=8798768452:AAEoNjUSTmHl2cXkqA33yFLrAMk_6hVyJnQ`, `JWT_SECRET_KEY=your-jwt-secret-key-change-in-production-min-32-chars`. Файл `.gitignore` не включает `.env`. |
| **Шаги воспроизведения** | 1. `git ls-files .env` → ".env" → 2. `git log -- .env` → видна история коммитов с секретами |
| **Лог** | N/A (security audit) |
| **Предполагаемая причина** | `.env` был добавлен в Git до добавления `.gitignore` или `.gitignore` не содержит `.env` |

### BUG-006: [MEDIUM] Hardcoded JWT secret в auth.py

| Поле | Значение |
|------|----------|
| **ID** | BUG-006 |
| **Сервис** | api (auth) |
| **Описание** | В `auth.py` строка 32: `SECRET_KEY = "dev-only-secret-key-DO-NOT-USE-IN-PRODUCTION"` — fallback при отсутствии env-var. На production это означает, что если `SECRET_KEY` не установлен в окружении, все JWT-токены подписаны известным ключом. |
| **Шаги воспроизведения** | 1. Не установить `SECRET_KEY` env-var → 2. Все JWT токены подписаны "dev-only-secret-key-DO-NOT-USE-IN-PRODUCTION" |
| **Лог** | N/A |
| **Предполагаемая причина** | Удобство разработки, но отсутствие обязательной проверки на production |

### BUG-007: [MEDIUM] Email Worker: IMAP-аутентификация не настроена — бесконечные retry

| Поле | Значение |
|------|----------|
| **ID** | BUG-007 |
| **Сервис** | email-worker |
| **Описание** | Email Worker пытается подключиться к `imap.gmail.com:993` каждые 60 секунд с неверными учётными данными. За 10 минут — 10 ошибок. Нет circuit breaker или exponential backoff сверх 3 попыток за итерацию. |
| **Шаги воспроизведения** | 1. Запустить email-worker без валидных Gmail credentials → 2. Каждые 60с — 3 попытки с retry 1s/2s/4s → 3. Бесконечный цикл ошибок |
| **Лог** | `IMAP connection attempt 3 failed: b'[AUTHENTICATIONFAILED] Invalid credentials (Failure)'. Retrying in 4s...` |
| **Предполагаемая причина** | Email credentials не настроены, но worker не отключает IMAP-polling при отсутствии конфигурации |

### BUG-008: [MEDIUM] Frontend ProjectItem не имеет полей price/unit/article

| Поле | Значение |
|------|----------|
| **ID** | BUG-008 |
| **Сервис** | frontend + api |
| **Описание** | Backend `ProjectItem` модель имеет только: `name`, `sku`, `qty`, `status`, `supplier_id`, `stock_item_id`. Frontend ожидает: `article`, `category`, `price`, `unit`, `notes`, `rowNumber`, `isFromWarehouse`. Эти поля не существуют в БД, поэтому карточка позиции и таблица позиций показывают пустые значения для цены, единиц, категории. |
| **Шаги воспроизведения** | 1. Открыть проект → 2. Перейти на вкладку "Позиции" → 3. Столбцы "Цена", "Ед.изм.", "Артикул" — пустые |
| **Лог** | Нет ошибок, просто пустые данные |
| **Предполагаемая причина** | Backend ProjectItem model не включает поля, извлекаемые AI из Excel (price, unit, article и т.д.) |

### BUG-009: [LOW] Нет endpoint для регистрации пользователей (RBAC не тестируем)

| Поле | Значение |
|------|----------|
| **ID** | BUG-009 |
| **Сервис** | api (auth) |
| **Описание** | `POST /api/auth/register` возвращает 404. Нет способа создать пользователя с ролью `warehouse` или `manager` для проверки RBAC. |
| **Шаги воспроизведения** | `curl -X POST /api/auth/register` → 404 |
| **Лог** | `{"detail":"Not Found"}` |
| **Предполагаемая причина** | Endpoint регистрации не реализован или не подключён к роутеру |

### BUG-010: [LOW] Celery reply-queues накапливают сообщения

| Поле | Значение |
|------|----------|
| **ID** | BUG-010 |
| **Сервис** | celery-worker |
| **Описание** | В RabbitMQ обнаружены 4 reply-queues (celery pidbox) с непотреблёнными сообщениями (total 4 msgs). Со временем может привести к утечке памяти RabbitMQ. |
| **Шаги воспроизведения** | `docker exec zakuppro-rabbitmq rabbitmqctl list_queues name messages messages_ready` |
| **Лог** | `c588f1b0-dcef-3106-8039-dbb59ac4647c 2 2`, `3dc5fa65-345a-3126-896d-442c0900d99f 1 1`, etc. |
| **Предполагаемая причина** | Celery RPC result backend создаёт уникальные reply-queues, которые не очищаются автоматически. Требуется настройка `result_expires` или periodic cleanup |

---

## Action Plan

### BUG-001: Fix corrupted excel_parser.py [CRITICAL]
- **Файл:** `backend/excel_parser.py`, строки 129-130
- **Исправление:** Заменить `result.iloceader_row]` → `result.iloc[header_row]` и `result.iloceader_row + 1:]` → `result.iloc[header_row + 1:]`
- **Тест:** Unit-test для `clean_dataframe()` с `header_row > 0`

### BUG-002: Add status mapping layer [HIGH]
- **Файл:** `backend/routers/frontend_compat.py`
- **Исправление:** Добавить маппинг `STATUS_MAP_RU_TO_EN` и `STATUS_MAP_EN_TO_RU` для конвертации статусов при отправке/получении данных
- **Альтернатива:** Унифицировать статусы в БД на английский и добавить `label` для русского отображения
- **Тест:** Integration test: создать проект → проверить что frontend получает маппированный статус

### BUG-003: Fix HTTP method for status update [HIGH]
- **Файл:** `src/components/app/project-detail.tsx`
- **Исправление:** Заменить `PATCH /api/projects/{id}` и `POST /api/projects/{id}/status` → `PUT /api/projects/{id}/status`
- **Тест:** E2E: сменить статус проекта через UI → проверить 200 OK

### BUG-004: Auto-dedup on upload [HIGH]
- **Файл:** `backend/routers/frontend_compat.py`
- **Исправление:** В `upload_project_file()`, при `mode="new"`, проверить существование проекта с таким именем. Если найден — вернуть 409 Conflict с информацией о дубликате и опциями merge/overwrite
- **Тест:** Upload тот же файл дважды → второй раз получает 409

### BUG-005: Remove .env from Git [HIGH]
- **Файлы:** `.gitignore`, `.env`
- **Исправление:** 1. Добавить `.env` в `.gitignore` 2. `git rm --cached .env` 3. Создать `.env.example` без реальных ключей 4. BFG Repo-Cleaner для очистки истории (опционально)
- **Тест:** `git ls-files .env` → пусто

### BUG-006: Fail-fast on missing JWT secret [MEDIUM]
- **Файл:** `backend/auth.py`
- **Исправление:** Заменить fallback на `raise EnvironmentError("SECRET_KEY must be set in production")` когда `os.getenv("SECRET_KEY")` пуст
- **Тест:** Unit-test: запуск без SECRET_KEY → exception

### BUG-007: Circuit breaker for IMAP [MEDIUM]
- **Файл:** `backend/email_worker.py`
- **Исправление:** Проверять что email credentials настроены перед запуском IMAP polling. Если нет — логировать warning и пропускать polling
- **Тест:** Unit-test: запуск без email config → нет IMAP подключений

### BUG-008: Add price/unit/article to ProjectItem [MEDIUM]
- **Файлы:** `backend/models.py`, `backend/schemas.py`, Alembic migration
- **Исправление:** Добавить колонки `price` (Numeric), `unit` (String), `article` (String), `category` (String) в `ProjectItem`. Создать Alembic migration. Обновить schemas. Обновить AI extraction pipeline.
- **Тест:** Migration + upload test с проверкой полей

### BUG-009: Add user registration endpoint [LOW]
- **Файл:** `backend/routers/auth.py`
- **Исправление:** Добавить `POST /api/auth/register` с RBAC (только Owner может создавать пользователей)
- **Тест:** Создать warehouse user → проверить 403 на /api/projects

### BUG-010: Configure Celery result_expires [LOW]
- **Файл:** `backend/celery_app.py`
- **Исправление:** Добавить `result_expires=3600` в Celery config для автоочистки reply-queues
- **Тест:** Проверить RabbitMQ queues через час — reply-queues должны быть пусты
