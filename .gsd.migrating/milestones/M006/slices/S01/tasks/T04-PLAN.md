---
estimated_steps: 6
estimated_files: 1
skills_used: []
---

# T04: Wire write-off and status history into project update router

Why: When a project transitions to 'В производстве', reserved stock must be written off and a status history record must be created. This is the final integration hook for S01.

Do:
1. In `backend/routers/projects.py` `update_project`, after updating fields but before commit: if the incoming status is "В производстве" and the old status was different, call `stock_service.write_off_for_production(project_id, db)`.
2. On every status change (old_status != new_status), create a `ProjectStatusHistory` record with from_status, to_status, changed_by=current_user.id. Log the transition.
3. Import `ProjectStatusHistory` from models and `write_off_for_production` from stock_service.

Done when: Updating a project status to 'В производстве' triggers write-off (verified via T05 tests). ProjectStatusHistory record is created on every status change.

## Inputs

- `backend/services/stock_service.py`
- `backend/routers/projects.py`
- `backend/models.py`
- `backend/schemas.py`
- `backend/auth.py`

## Expected Output

- `backend/routers/projects.py`

## Verification

cd backend && python -c "from backend.routers.projects import update_project; print('update_project importable')"

## Observability Impact

ProjectStatusHistory table now populated on every status change — a future agent can query it for full audit trail. Write-off triggers on production transition, decreasing StockItem.qty_total and qty_reserved.
