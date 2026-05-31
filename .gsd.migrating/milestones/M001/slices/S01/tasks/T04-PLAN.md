---
estimated_steps: 5
estimated_files: 1
skills_used: []
---

# T04: Test migration apply/rollback

1. Применить миграцию: alembic upgrade head
2. Проверить схемы через psql (\d table_name)
3. Откатить: alembic downgrade -1
4. Повторить apply
5. Убедиться что данные не теряются (create test data before rollback)

## Inputs

- `PostgreSQL БД`
- `migration из T03`

## Expected Output

- `тест migration passing`
- `alembic current показывает последнюю версию`

## Verification

pytest tests/test_migration.py проходит; миграция применяется и откатывается; foreign keys работают
