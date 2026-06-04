---
estimated_steps: 7
estimated_files: 3
skills_used: []
---

# T01: Create ProjectStatusHistory model, migration, and schemas

Why: ProjectStatusHistory is needed by S02 for Kanban guardrail audit trail, but S01 must write it first so status change tracking works from the start. This task lays the data foundation for both S01 write-off recording and S02 transition validation.

Do:
1. Add `ProjectStatusHistory` model to `backend/models.py` with fields: id (PK), project_id (FK→projects.id), from_status (String(50)), to_status (String(50)), changed_by (Integer, FK→users.id), changed_at (DateTime, server_default=func.now()).
2. Add `StockReceiveRequest` schema to `backend/schemas.py`: `class StockReceiveRequest(BaseModel): qty: int = Field(..., gt=0)`.
3. Add `ProjectStatusHistoryResponse` schema to `backend/schemas.py` with all fields + model_config.
4. Create a new alembic migration that adds the `project_status_history` table. Revision must chain from `b3ae192ecc5f` (latest).

Done when: Model imports cleanly, schema validates, migration can be applied and downgraded.

## Inputs

- `backend/models.py`
- `backend/schemas.py`
- `backend/alembic/versions/b3ae192ecc5f_add_production_task_delay_tracking.py`
- `backend/alembic/env.py`

## Expected Output

- `backend/alembic/versions/xxxx_add_project_status_history.py`

## Verification

cd backend && python -c "from backend.models import ProjectStatusHistory; print('Model OK')" && python -c "from backend.schemas import StockReceiveRequest, ProjectStatusHistoryResponse; print('Schemas OK')" && python -m alembic upgrade head && python -m alembic downgrade -1 && python -m alembic upgrade head

## Observability Impact

Adds ProjectStatusHistory table enabling full audit trail of project status changes — a future agent can query this table to reconstruct the status timeline for any project.
