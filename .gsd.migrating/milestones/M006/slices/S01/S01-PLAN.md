# S01: Stock Reservation Engine

**Goal:** Auto-reserve stock on BOM creation, write off reserved stock on production start, enforce inventory invariant qty_total = qty_reserved + qty_available at service layer, and provide a goods receipt endpoint.
**Demo:** Create a project with BOM items matching existing warehouse SKUs — StockItem.qty_reserved increases and qty_available decreases automatically. Move project to production — reserved stock is written off (qty_total and qty_reserved decrease). Receive goods via new endpoint — qty_total and qty_available increase. Run the round-trip test proving qty_total = qty_reserved + qty_available always holds.

## Must-Haves

- StockItem.qty_reserved increases and qty_available decreases when ProjectItems with matching SKUs are created
- StockItem.qty_reserved decreases and qty_total decreases when project transitions to "В производстве"
- POST /api/stock-items/{id}/receive increases both qty_total and qty_available by the received quantity
- Invariant qty_total = qty_reserved + qty_available holds after every stock mutation
- ProjectStatusHistory record is created on every project status change
- Round-trip test passes: create project with BOM → reserve → write off → verify invariant holds throughout
- All existing tests continue to pass (`cd backend && python -m pytest tests/ -v --tb=short`)

## Proof Level

- This slice proves: integration

## Integration Closure

Upstream surfaces consumed: none (first slice in M006). New wiring: stock_service.py as single entry point for all stock mutations; reservation hooks in project_items router and Celery process_bom_to_project task; write-off hook in projects router on status change; receive endpoint in stock_items router. What remains before milestone is truly usable end-to-end: S02 transition guard that reads reserved quantities and blocks premature production starts; S03 readiness matrix that queries stock state for per-project color indicators.

## Verification

- Runtime signals: structured INFO logs on every reserve/write-off/receive operation with quantities and IDs. Inspection surfaces: ProjectStatusHistory table provides full audit trail of status changes; StockItem quantities readable via existing GET /api/stock-items endpoint. Failure visibility: invariant violations raise ValueError with descriptive message; partial reservation warnings logged with project and SKU details.

## Tasks

- [x] **T01: Create ProjectStatusHistory model, migration, and schemas** `est:30m`
  Why: ProjectStatusHistory is needed by S02 for Kanban guardrail audit trail, but S01 must write it first so status change tracking works from the start. This task lays the data foundation for both S01 write-off recording and S02 transition validation.
  - Files: `backend/models.py`, `backend/schemas.py`, `backend/alembic/versions/xxxx_add_project_status_history.py`
  - Verify: cd backend && python -c "from backend.models import ProjectStatusHistory; print('Model OK')" && python -c "from backend.schemas import StockReceiveRequest, ProjectStatusHistoryResponse; print('Schemas OK')" && python -m alembic upgrade head && python -m alembic downgrade -1 && python -m alembic upgrade head

- [x] **T02: Build stock_service.py with three core primitives and add receive endpoint** `est:1h`
  Why: stock_service.py is the single entry point for all stock mutations, enforcing the invariant qty_total = qty_reserved + qty_available at the service layer (per MEM105). The receive endpoint gives warehouse operators a way to record incoming goods.
  - Files: `backend/services/stock_service.py`, `backend/routers/stock_items.py`, `backend/schemas.py`
  - Verify: cd backend && python -c "from backend.services.stock_service import reserve_for_project, write_off_for_production, receive_stock; print('All functions importable')" && python -c "from backend.routers.stock_items import router; print('Router has receive endpoint')"

- [ ] **T03: Wire reservation into ProjectItem create/update and Celery BOM task** `est:45m`
  Why: Reservation must fire automatically when ProjectItems are created (API or Celery task). This task hooks stock_service.reserve_for_project into the two code paths that create ProjectItems.
  - Files: `backend/routers/project_items.py`, `backend/tasks.py`
  - Verify: cd backend && python -c "from backend.routers.project_items import create_project_item, update_project_item; from backend.tasks import process_bom_to_project; print('All modified functions importable')"

- [ ] **T04: Wire write-off and status history into project update router** `est:30m`
  Why: When a project transitions to 'В производстве', reserved stock must be written off and a status history record must be created. This is the final integration hook for S01.
  - Files: `backend/routers/projects.py`
  - Verify: cd backend && python -c "from backend.routers.projects import update_project; print('update_project importable')"

- [ ] **T05: Write comprehensive tests and verify existing test suite** `est:1h`
  Why: S01 has a high risk rating and touches inventory integrity. Comprehensive tests are the only proof the invariant holds across all code paths. Tests must cover the round-trip scenario described in the roadmap demo.
  - Files: `backend/tests/test_stock_service.py`
  - Verify: cd backend && python -m pytest tests/test_stock_service.py -v --tb=short && python -m pytest tests/ -v --tb=short

## Files Likely Touched

- backend/models.py
- backend/schemas.py
- backend/alembic/versions/xxxx_add_project_status_history.py
- backend/services/stock_service.py
- backend/routers/stock_items.py
- backend/routers/project_items.py
- backend/tasks.py
- backend/routers/projects.py
- backend/tests/test_stock_service.py
