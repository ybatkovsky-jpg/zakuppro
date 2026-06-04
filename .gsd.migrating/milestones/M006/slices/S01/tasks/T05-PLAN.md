---
estimated_steps: 13
estimated_files: 1
skills_used: []
---

# T05: Write comprehensive tests and verify existing test suite

Why: S01 has a high risk rating and touches inventory integrity. Comprehensive tests are the only proof the invariant holds across all code paths. Tests must cover the round-trip scenario described in the roadmap demo.

Do:
1. Create `backend/tests/test_stock_service.py` with these test classes/functions:
   - `TestReserveForProject`: full match reserves all qty, partial match reserves what's available, no match is no-op, SKU match sets stock_item_id, invariant holds after reserve
   - `TestWriteOffForProduction`: write-off decreases qty_total and qty_reserved, write-off for project with no reservations is no-op, invariant holds after write-off
   - `TestReceiveStock`: qty_total and qty_available increase by received qty, qty_reserved unchanged, invariant holds after receive, zero qty raises validation error
   - `TestRoundTrip`: create project + items → reserve → verify quantities → write-off → verify quantities → verify invariant holds throughout
   - `TestReceiveEndpoint`: POST returns 200 with updated stock item, POST with invalid auth returns 401
   - `TestReservationOnProjectItemCreate`: creating ProjectItem with matching SKU triggers reservation (integration test via API or direct function call)
   - `TestWriteOffOnStatusChange`: updating project to 'В производстве' triggers write-off and records ProjectStatusHistory
   - `TestProjectStatusHistory`: status history record created with correct from_status, to_status, changed_by
2. Run the full existing test suite to confirm no regressions.

Done when: All new tests pass. All existing tests pass (`cd backend && python -m pytest tests/ -v --tb=short` returns 0 failures).

## Inputs

- `backend/services/stock_service.py`
- `backend/models.py`
- `backend/schemas.py`
- `backend/routers/stock_items.py`
- `backend/routers/project_items.py`
- `backend/routers/projects.py`
- `backend/tasks.py`
- `backend/tests/conftest.py`
- `backend/main.py`

## Expected Output

- `backend/tests/test_stock_service.py`

## Verification

cd backend && python -m pytest tests/test_stock_service.py -v --tb=short && python -m pytest tests/ -v --tb=short
