# S02: Kanban Guardrails

**Goal:** Build transition guard that blocks project status change to "В производстве" when ProjectItems are not all "На складе" or "Оплачено". Return 422 with blocking reason. Status history is recorded on every change. Existing Kanban drag-and-drop still works for valid transitions.
**Demo:** Try to drag a project to В производстве when some items are still К закупке — the transition is rejected with a clear reason. When all items are На складе or Оплачено, the transition succeeds. Status history is recorded on every change. The existing Kanban drag-and-drop still works for valid transitions.

## Must-Haves

- transition_service.can_transition_to returns (False, reason) when ProjectItems include К закупке/Запрошено/Счет получен; returns (True, empty) when all items are На складе or Оплачено; update_project returns HTTP 422 with descriptive reason when transition blocked; update_project allows transition and fires write-off when guard passes; ProjectStatusHistory recorded on every status change; all existing tests continue to pass

## Proof Level

- This slice proves: integration

## Integration Closure

Upstream surfaces consumed: S01 stock_service.py (write_off_for_production still fires on valid В производстве transition). New wiring: transition_service.py as single entry point for transition validation; guard called in projects.py update_project before write_off_for_production. Remaining: S03 readiness matrix queries project item statuses for per-project color indicators.

## Verification

- Runtime signals: structured INFO logs on blocked transitions with project ID, item counts per status, and blocking reason. HTTP 422 responses with item-level breakdown. Inspection surfaces: ProjectStatusHistory table from S01 provides audit trail.

## Tasks

- [x] **T01: Build transition_service.py with can_transition_to guard** `est:30m`
  Create backend/services/transition_service.py with can_transition_to(project, target_status, db) returning (bool, reason). For В производстве target, verifies every ProjectItem is На складе or Оплачено. Returns blocking reason with item counts when not ready.
  - Files: `backend/services/transition_service.py`
  - Verify: cd backend && python -c "from backend.services.transition_service import can_transition_to; print('transition_service importable')"

- [x] **T02: Wire transition guard into project update router** `est:30m`
  Add can_transition_to check in update_project before allowing status change. Return HTTP 422 with descriptive reason when blocked. Ensure StatusHistory and write-off still fire on valid transitions.
  - Files: `backend/routers/projects.py`
  - Verify: cd backend && python -c "from backend.routers.projects import update_project; print('update_project importable')"

- [x] **T03: Write transition guard tests and verify existing suite** `est:45m`
  Write tests for can_transition_to covering: blocks when items are К закупке, blocks when mixed statuses, allows when all На складе, allows when all Оплачено, allows mixed На складе/Оплачено. Test 422 integration via API. Verify full test suite passes.
  - Files: `backend/tests/test_transition_service.py`
  - Verify: cd backend && python -m pytest tests/test_transition_service.py -v --tb=short && python -m pytest tests/ -v --tb=short

## Files Likely Touched

- backend/services/transition_service.py
- backend/routers/projects.py
- backend/tests/test_transition_service.py
