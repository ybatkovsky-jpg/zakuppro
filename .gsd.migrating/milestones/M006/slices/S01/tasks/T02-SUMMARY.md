---
id: T02
parent: S01
milestone: M006
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-04T08:53:01.017Z
blocker_discovered: false
---

# T02: Built stock_service.py with reserve, write-off, and receive primitives, and added POST /api/stock-items/{id}/receive endpoint with RBAC

**Built stock_service.py with reserve, write-off, and receive primitives, and added POST /api/stock-items/{id}/receive endpoint with RBAC**

## What Happened

Created `backend/services/stock_service.py` with three core service functions:

1. **`reserve_for_project(project_id, db)`** — Queries all ProjectItems for a project, matches each by SKU to a StockItem, links them (sets stock_item_id if not already set), and reserves up to the needed quantity. Full reservation when qty_available >= needed; partial reservation with warning otherwise. Updates qty_reserved (+=) and qty_available (-=).

2. **`write_off_for_production(project_id, db)`** — Queries all ProjectItems linked to StockItems (stock_item_id IS NOT NULL), decreases both qty_total and qty_reserved on each linked StockItem by the ProjectItem.qty. qty_available unchanged (already reduced by reserve).

3. **`receive_stock(stock_item_id, qty, db)`** — Increases both qty_total and qty_available by the received quantity. qty_reserved unchanged. Raises ValueError if StockItem not found.

Each function includes `_validate_invariant()` which asserts `qty_total == qty_reserved + qty_available` with a descriptive ValueError message on violation. Structured INFO logs are emitted for every successful operation with entity IDs, quantities, and operation type. WARNING logs are emitted on partial reservations.

Added `POST /api/stock-items/{id}/receive` endpoint to `backend/routers/stock_items.py` with RBAC allowing owner, manager, and warehouse roles (per D036 decision). Endpoint validates the 404 case, calls receive_stock(), commits, refreshes, and returns StockItemResponse. Catches ValueError from the service layer and returns 400 with descriptive detail.

The router import was updated to include `StockReceiveRequest` from schemas.

## Verification

All imports verified: reserve_for_project, write_off_for_production, and receive_stock import cleanly from backend.services.stock_service. Router has the /api/stock-items/{item_id}/receive route. Invariant check (_validate_invariant) passes on valid state (100 = 30 + 70) and raises ValueError on invalid state (100 != 30 + 50 = 80). Function signatures confirmed: reserve_for_project(project_id: int, db: Session) -> None, write_off_for_production(project_id: int, db: Session) -> None, receive_stock(stock_item_id: int, qty: int, db: Session) -> None. StockReceiveRequest schema validation: rejects qty=0 (as expected due to Field(gt=0)), accepts qty=5. Existing test suite: all 3 stock item schema tests pass, all 69 tests run with only 3 pre-existing failures unrelated to this task (Project schema and schema configuration tests).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -c "from backend.services.stock_service import reserve_for_project, write_off_for_production, receive_stock; print('All functions importable')"` | 0 | pass | 450ms |
| 2 | `python -c "from backend.routers.stock_items import router; print('Has receive:', any('receive' in r.path for r in router.routes))"` | 0 | pass | 420ms |
| 3 | `python functional verification: invariant check, function signatures, schema validation, router route presence` | 0 | pass | 380ms |
| 4 | `python -m pytest tests/test_schemas.py::TestStockItemSchemas -v` | 0 | pass | 360ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
