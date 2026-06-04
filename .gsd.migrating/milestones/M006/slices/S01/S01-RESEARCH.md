# S01: Stock Reservation Engine — Research

**Date:** 2026-06-04  
**Depth:** Targeted research (known technology, new code in this codebase)

## Summary

S01 needs to introduce three stock operation primitives (reserve, write-off, receive) and enforce the invariant `qty_total = qty_reserved + qty_available` at the service layer. The StockItem model, schemas, and CRUD router already exist. What's missing: the service layer that enforces the invariant, a receive endpoint, and integration hooks into existing ProjectItem creation/update and project status-change flows.

## Recommendation

**Approach:** Create `backend/services/stock_service.py` as the single entry point for all stock mutations. Add `POST /api/stock-items/{id}/receive` to the existing stock_items router. Hook reservation into the ProjectItem create/update routers and the `process_bom_to_project` Celery task. Hook unreserve into ProjectItem delete and Project delete endpoints. Create a `ProjectStatusHistory` model now (needed by S02 but its absence blocks write-off tracking for S01's production transition).

**First proof to build:** The round-trip test: create project with BOM → reserve → write off → verify `qty_total = qty_reserved + qty_available` holds throughout.

**Do NOT** add database triggers or constraints for the invariant — enforce at service layer per MEM105.

## Implementation Landscape

### Files to create

| File | Purpose |
|---|---|
| `backend/services/stock_service.py` | Five functions: `reserve_for_project`, `write_off_for_production`, `receive_stock`, `unreserve_for_project_item`, `unreserve_for_project`. Each validates and maintains the invariant. |
| `backend/tests/test_stock_service.py` | Unit tests for all three service functions + invariant edge cases (zero qty, negative, oversubscription). |

### Files to modify

| File | Change |
|---|---|
| `backend/models.py` | Add `ProjectStatusHistory` model (fields: id, project_id, from_status, to_status, changed_by, changed_at). Needed for S02 audit trail but S01 write-off needs to record the transition. |
| `backend/schemas.py` | Add `StockReceiveRequest` (qty: int) and `ProjectStatusHistoryResponse` schemas. |
| `backend/routers/stock_items.py` | Add `POST /api/stock-items/{id}/receive` endpoint. RBAC: owner + manager + warehouse. |
| `backend/routers/project_items.py` | After create/update, call `stock_service.reserve_for_project(project_id, db)` to auto-reserve matching SKUs. On delete, call `stock_service.unreserve_for_project_item(item_id, db)` to release reservation. |
| `backend/routers/projects.py` | On status change to "В производстве", call `stock_service.write_off_for_production(project_id, db)`. Write ProjectStatusHistory record. |
| `backend/tasks.py` | In `process_bom_to_project`, after creating ProjectItems, call `stock_service.reserve_for_project(project_id, db)`. Update `reserved_count` in result and Telegram message. |
| `backend/schemas/__init__.py` | Re-export new schemas (if following existing pattern). |
| `backend/main.py` | No change needed — stock_items router already registered. |

### Files NOT to modify

- `backend/database.py` — no changes needed
- `backend/auth.py` / `backend/rbac.py` — existing RBAC patterns are sufficient
- `backend/models.py` relationships — StockItem.project_items and ProjectItem.stock_item relationships already exist

## Design Decisions

### Invariant enforcement: service layer

Per MEM105, enforce `qty_total = qty_reserved + qty_available` in `stock_service.py`, not via DB constraints. Every mutation function validates the invariant post-operation and raises `ValueError` with a clear message if violated.

### Reservation trigger: on ProjectItem create/update

When a ProjectItem is created or updated with a `stock_item_id` (set by SKU matching or manually), call `reserve_for_project`. This means the router layer is responsible for calling the service after committing the ProjectItem. For the Celery task path, call it after all ProjectItems are created.

### SKU matching: in the service, not the router

`reserve_for_project(project_id, db)` queries all ProjectItems for the project, finds their SKUs, and matches against StockItem.sku. If a ProjectItem has `stock_item_id` set but no matching StockItem by SKU, it's a no-op for that item (no error). If a StockItem with matching SKU exists but isn't linked, the service sets `stock_item_id` and reserves.

### Receive endpoint: qty_total increases, qty_available increases

`POST /api/stock-items/{id}/receive` with `{"qty": N}` increases both `qty_total` and `qty_available` by N. `qty_reserved` is unchanged. This models physical goods arriving at the warehouse.

### Write-off: only when status transitions to "В производстве"

`write_off_for_production(project_id, db)` decreases `qty_total` and `qty_reserved` for all reserved StockItems linked to the project's ProjectItems. Called from the project update router when the new status is "В производстве". This models goods physically leaving the warehouse.

### ProjectStatusHistory: create now for S02 use

The model stores: `id`, `project_id` (FK), `from_status`, `to_status`, `changed_by` (user ID), `changed_at` (timestamp). Written synchronously in the project update router on every status change. S02 will add transition validation on top of this infrastructure.

## Constraints & Risks

### Risk: race conditions on concurrent reservations

Two Celery tasks processing BOM files simultaneously could read the same `qty_available` before either writes. Mitigation: use `SELECT ... FOR UPDATE` row-level locking in the service layer for the reserve operation, or accept the risk as low-probability given single-owner usage pattern. **Decision deferred to planner** — note as a known limitation for now.

### Risk: oversubscription (reserving more than available)

The service must check `qty_available >= requested_qty` before reserving. If insufficient, the reservation should be partial (reserve what's available, leave the rest unlinked) and log a warning. The roadmap implies full reservation but partial is safer for real-world operation.

### Constraint: no alembic migration needed for StockItem

The `stock_items` table already has `qty_total`, `qty_reserved`, `qty_available` columns in the initial schema migration. Only `ProjectStatusHistory` needs a new migration.

### Constraint: SQLite test compatibility

Tests use in-memory SQLite. `SELECT ... FOR UPDATE` works in SQLite but behaves differently (database-level lock vs row-level). Test the invariant logic, not the locking behavior.

### Constraint: Telegram notifier already expects reserved_count

`telegram_notifier.py:67` already accepts `reserved_count` parameter. The `process_bom_to_project` task just needs to pass a non-zero value after reservation.

## Requirements Coverage

- **R013** (Stock reservation): S01 directly owns this. The `reserve_for_project` function + integration hooks fulfill auto-reservation on BOM creation.
- **R012** (Kanban guardrails): S01 supports by providing accurate `qty_reserved`/`qty_available` values that S02's transition guard will read. Also creates `ProjectStatusHistory` model that S02 uses.
- **R014** (Readiness matrix): S01 supports by ensuring StockItem quantities are accurate, which S03 will query for per-project readiness.

## Verification

### Unit tests (test_stock_service.py)

```
test_reserve_for_project_full_match — SKU matches, full qty reserved
test_reserve_for_project_partial — insufficient available, partial reservation
test_reserve_for_project_no_match — no StockItems match ProjectItem SKUs
test_reserve_for_project_invariant — verify qty_total = qty_reserved + qty_available after reserve
test_write_off_for_production — reserved stock decreases qty_total and qty_reserved
test_write_off_for_production_invariant — verify invariant after write-off
test_receive_stock — qty_total and qty_available increase
test_receive_stock_invariant — verify invariant after receive
test_round_trip — reserve → write_off → verify invariant holds
```

### Integration tests (test_stock_service.py or separate)

```
test_receive_endpoint — POST /api/stock-items/{id}/receive returns correct response
test_receive_endpoint_unauthorized — 401 without auth
test_project_item_create_triggers_reservation — creating ProjectItem with matching SKU reserves stock
test_project_status_change_triggers_writeoff — updating project to "В производстве" writes off stock
```

### Run existing tests

```
cd backend && python -m pytest tests/ -v --tb=short
```

All existing tests must continue to pass.

## Open Questions for Planner

1. **Partial vs full reservation:** If a ProjectItem needs 10 units and only 3 are available, reserve 3 (partial) or fail? Recommend: partial reservation + log warning. This matches real warehouse behavior.

2. **Write-off scope:** Write off ALL reserved items for the project, or only items whose ProjectItem status is "На складе"? The roadmap says "reserved stock is written off" — recommend all reserved items regardless of ProjectItem status.

3. **Receive endpoint auth:** Should warehouse role be allowed to receive stock? Per RBAC matrix, warehouse has full CRUD on StockItem — yes, allow warehouse role on receive.

4. **ProjectStatusHistory migration:** Create a new alembic migration for this model, or add it as a raw SQLAlchemy `Base.metadata.create_all` table? Recommend alembic migration for consistency.
