---
id: T03
parent: S01
milestone: M006
key_files:
  - backend/routers/project_items.py
  - backend/tasks.py
key_decisions:
  - Reservation fires post-commit in API endpoints so the ProjectItem row exists before stock_service.reserve_for_project queries by project_id
  - Second db.commit() after reserve_for_project to persist the StockItem quantity changes within the same request scope
  - Reserved count in tasks.py is derived from ProjectItem.stock_item_id IS NOT NULL after reservation — the authoritative signal that a match and reservation occurred
duration: 
verification_result: passed
completed_at: 2026-06-04T09:02:30.163Z
blocker_discovered: false
---

# T03: Wired stock_service.reserve_for_project into ProjectItem create/update API endpoints and the Celery process_bom_to_project task with live reserved_count.

**Wired stock_service.reserve_for_project into ProjectItem create/update API endpoints and the Celery process_bom_to_project task with live reserved_count.**

## What Happened

Wired the stock reservation primitive into both code paths that create ProjectItems:

1. **`backend/routers/project_items.py`**: Added `from backend.services import stock_service` import. In `create_project_item`, after the initial commit + refresh, called `stock_service.reserve_for_project(new_item.project_id, db)` followed by a second `db.commit()` to persist reservation changes. Same pattern in `update_project_item` after the update commit — re-reserving for the project to capture SKU/qty changes.

2. **`backend/tasks.py`**: Added `from backend.services import stock_service` import in the DB operations block. After Step 5 (ProjectItem creation + commit), call `stock_service.reserve_for_project(project.id, db)` + `db.commit()`. Count linked items via `db.query(ProjectItem).filter(project_id=..., stock_item_id.isnot(None)).count()`. Pass the live `reserved_count` to both `send_completion_message()` and the result dict. Updated the docstring to reflect that reserved_count is no longer hardcoded.

The reservation fires automatically on API creates/updates and during async BOM processing. StockItem quantities adjust in response, making warehouse state visible via GET /api/stock-items.

## Verification

Ran import verification from project root: `python -c "from backend.routers.project_items import create_project_item, update_project_item; from backend.tasks import process_bom_to_project; print('All modified functions importable')"` — all three functions imported successfully with the new stock_service wiring. No syntax or import errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd D:/CLAUDE/Project/zakuppro/zakuppro && python -c "from backend.routers.project_items import create_project_item, update_project_item; from backend.tasks import process_bom_to_project; print('All modified functions importable')"` | 0 | pass | 1500ms |

## Deviations

The task plan said to call `reserve_for_project(item_data.project_id, db)` after `create_project_item`. Used `new_item.project_id` instead for clarity since the new item object is available post-refresh.

## Known Issues

None

## Files Created/Modified

- `backend/routers/project_items.py`
- `backend/tasks.py`
