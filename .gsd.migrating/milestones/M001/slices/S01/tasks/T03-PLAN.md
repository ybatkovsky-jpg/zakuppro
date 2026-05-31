---
estimated_steps: 4
estimated_files: 1
skills_used: []
---

# T03: Create first Alembic migration

1. Создать миграцию: alembic revision --autogenerate -m "Initial schema"
2. Проверить сгенерированный SQL
3. При необходимости вручную добавить индексы (например, на project.status, supplier.email)
4. Убедиться что все foreign keys корректны

## Inputs

- `SQLAlchemy models из T02`

## Expected Output

- `migration file создан`
- `SQL генерируется корректно`

## Verification

alembic upgrade head применяет миграцию; psql \dt показывает все таблицы
