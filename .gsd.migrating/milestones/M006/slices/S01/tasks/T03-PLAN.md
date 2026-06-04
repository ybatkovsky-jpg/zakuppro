---
estimated_steps: 5
estimated_files: 2
skills_used: []
---

# T03: Wire reservation into ProjectItem create/update and Celery BOM task

Why: Reservation must fire automatically when ProjectItems are created (API or Celery task). This task hooks stock_service.reserve_for_project into the two code paths that create ProjectItems.

Do:
1. In `backend/routers/project_items.py`, after creating a ProjectItem (`create_project_item`), call `stock_service.reserve_for_project(item_data.project_id, db)` post-commit. After updating a ProjectItem (`update_project_item`), call `stock_service.reserve_for_project(item.project_id, db)` post-commit.
2. In `backend/tasks.py` `process_bom_to_project`, after Step 5 (ProjectItem creation + commit), call `stock_service.reserve_for_project(project.id, db)`. Count reserved items. Update the `reserved_count` value in the Telegram completion message (currently hardcoded 0) and in the result dict.

Done when: Creating a ProjectItem with matching warehouse SKU triggers reservation (verified via T05 tests). process_bom_to_project task passes reserved_count > 0 when StockItems match.

## Inputs

- `backend/services/stock_service.py`
- `backend/routers/project_items.py`
- `backend/tasks.py`
- `backend/models.py`
- `backend/telegram_notifier.py`

## Expected Output

- `backend/routers/project_items.py`
- `backend/tasks.py`

## Verification

cd backend && python -c "from backend.routers.project_items import create_project_item, update_project_item; from backend.tasks import process_bom_to_project; print('All modified functions importable')"

## Observability Impact

Reservation is now triggered from both API and async task paths. StockItem quantities change in response to ProjectItem mutations, making warehouse state observable via the existing GET /api/stock-items endpoint.
