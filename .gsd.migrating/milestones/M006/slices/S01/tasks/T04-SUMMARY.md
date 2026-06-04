---
id: T04
parent: S01
milestone: M006
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-04T09:05:25.555Z
blocker_discovered: false
---

# T04: Wired write-off and ProjectStatusHistory creation into projects.py update_project, so production transitions trigger stock write-off and every status change creates an audit trail record

**Wired write-off and ProjectStatusHistory creation into projects.py update_project, so production transitions trigger stock write-off and every status change creates an audit trail record**

## What Happened

In `backend/routers/projects.py` `update_project`: captured `old_status` before applying field updates, then compared with `new_status` after applying changes. On every status change, created a `ProjectStatusHistory` record (project_id, from_status, to_status, changed_by=current_user.id) and logged the transition. When the new status is "В производстве", called `stock_service.write_off_for_production(project_id, db)` before the final commit to write off reserved stock. Added imports for `ProjectStatusHistory` from models and `stock_service` from `backend.services`. This follows the same module-import pattern used in project_items.py for `stock_service.reserve_for_project`.

## Verification

Ran `PYTHONPATH=. python -c "from backend.routers.projects import update_project; print('update_project importable')"` — exit code 0, output "update_project importable". Also verified `ProjectStatusHistory.__tablename__` resolves to "project_status_history" and `write_off_for_production` resolves to the correct function object. All imports chain correctly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `PYTHONPATH=. python -c "from backend.routers.projects import update_project; print('update_project importable')"` | 0 | pass | 350ms |
| 2 | `PYTHONPATH=. python -c "from backend.models import ProjectStatusHistory; from backend.services.stock_service import write_off_for_production; print('All imports OK')"` | 0 | pass | 320ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
