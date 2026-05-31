---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T05: Add indexes for performance

Добавить индексы на часто запрашиваемые поля:
- project.status (для Kanban фильтрации)
- project_item.project_id
- project_item.status
- supplier.email (для поиска)
- stock_item.sku (уникальный)
- invoice.status

Обновить миграцию или создать новую.

## Inputs

- `схема из T03`

## Expected Output

- `индексы созданы`
- `migration applies`

## Verification

psql \di показывает индексы; EXPLAIN показывает использование индексов
