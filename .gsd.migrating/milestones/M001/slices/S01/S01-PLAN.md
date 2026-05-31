# S01: PostgreSQL Schema + Alembic Setup

**Goal:** Создать полную схему БД по SPEC с Alembic миграциями. PostgreSQL схема включает все сущности из SPEC.md с правильными типами, индексами и foreign keys.
**Demo:** После этого: `alembic revision head` применяет схему к пустой БД; все таблицы созданы с правильными типами, индексами и foreign keys

## Must-Haves

- PostgreSQL схема создана через Alembic миграцию
- Все таблицы из SPEC.md существуют (project, project_item, supplier, stock_item, purchase_order, invoice, payment, unresolved_transaction, production_task)
- Foreign keys настроены корректно
- Индексы на часто запрашиваемых полях
- Migration applies и rollback без ошибок

## Proof Level

- This slice proves: contract: pytest с fixtures проверяет миграции; тестовые данные создаются и читаются; foreign key constraints enforce

## Integration Closure

integration: реальная PostgreSQL БД (через docker или локальная); psql подтверждает схемы; migration откатывается без потери данных

## Verification

- SQL команды логируются при миграции; ошибки миграции показывают контекст; version table фиксирует успешные миграции

## Tasks

- [x] **T01: Setup PostgreSQL connection и Alembic** `est:20m`
  1. Установить зависимости (psycopg2, alembic, sqlalchemy)
  2. Создать .env с DATABASE_URL
  3. Инициализировать Alembic (alembic init)
  4. Настроить alembic.ini и env.py для PostgreSQL
  - Files: `alembic.ini`, `alembic/env.py`, `.env`
  - Verify: alembic current - показывает revision; alembic history работает

- [x] **T02: Create Base SQLAlchemy models** `est:30m`
  Создать базовые SQLAlchemy модели для всех таблиц из SPEC.md. Пока без relationships - только структура таблиц.
  - Files: `models/base.py`, `models/__init__.py`
  - Verify: Python импортирует модели без ошибок; структура совпадает с SPEC

- [x] **T03: Create first Alembic migration** `est:25m`
  1. Создать миграцию: alembic revision --autogenerate -m "Initial schema"
  2. Проверить сгенерированный SQL
  3. При необходимости вручную добавить индексы (например, на project.status, supplier.email)
  4. Убедиться что все foreign keys корректны
  - Files: `alembic/versions/001_initial_schema.py`
  - Verify: alembic upgrade head применяет миграцию; psql \dt показывает все таблицы

- [ ] **T04: Test migration apply/rollback** `est:20m`
  1. Применить миграцию: alembic upgrade head
  2. Проверить схемы через psql (\d table_name)
  3. Откатить: alembic downgrade -1
  4. Повторить apply
  5. Убедиться что данные не теряются (create test data before rollback)
  - Files: `tests/test_migration.py`
  - Verify: pytest tests/test_migration.py проходит; миграция применяется и откатывается; foreign keys работают

- [ ] **T05: Add indexes for performance** `est:15m`
  Добавить индексы на часто запрашиваемые поля:
  - project.status (для Kanban фильтрации)
  - project_item.project_id
  - project_item.status
  - supplier.email (для поиска)
  - stock_item.sku (уникальный)
  - invoice.status
  - Files: `alembic/versions/002_add_indexes.py`
  - Verify: psql \di показывает индексы; EXPLAIN показывает использование индексов

## Files Likely Touched

- alembic.ini
- alembic/env.py
- .env
- models/base.py
- models/__init__.py
- alembic/versions/001_initial_schema.py
- tests/test_migration.py
- alembic/versions/002_add_indexes.py
