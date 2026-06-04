# M006: Business Logic Polish

**Vision:** Automate warehouse operations and enforce business rules: auto-reserve stock on BOM creation, block premature production starts, and surface per-project readiness at a glance with color indicators.

## Success Criteria

- Stock reservation runs automatically when ProjectItems are created or updated with matching warehouse SKUs
- Inventory invariant qty_total = qty_reserved + qty_available is enforced at the service layer
- Transition to В производстве returns 422 with blocking reason when ProjectItems are not all На складе or Оплачено
- ProjectStatusHistory record is created on every status change
- Readiness endpoint returns per-project green/yellow/red status with item counts by procurement stage
- All existing tests continue to pass across backend and frontend

## Slices

- [x] **S01: S01** `risk:high` `depends:[]`
  > After this: Create a project with BOM items matching existing warehouse SKUs — StockItem.qty_reserved increases and qty_available decreases automatically. Move project to production — reserved stock is written off (qty_total and qty_reserved decrease). Receive goods via new endpoint — qty_total and qty_available increase. Run the round-trip test proving qty_total = qty_reserved + qty_available always holds.

- [x] **S02: S02** `risk:medium` `depends:[]`
  > After this: Try to drag a project to В производстве when some items are still К закупке — the transition is rejected with a clear reason. When all items are На складе or Оплачено, the transition succeeds. Status history is recorded on every change. The existing Kanban drag-and-drop still works for valid transitions.

- [ ] **S03: Project Readiness Matrix** `risk:low` `depends:[S01,S02]`
  > After this: Open the projects dashboard — each project card shows a colored indicator: green (all items На складе or Оплачено), yellow (some items in transit: Запрошено or Счет получен), red (some items still К закупке). Click through to see the breakdown by item status.

## Boundary Map

### S01 → S02

Produces:
- `backend/services/stock_service.py` with `reserve_for_project(project_id, db)`, `write_off_for_production(project_id, db)`, `receive_stock(stock_item_id, qty, db)`
- `POST /api/stock-items/{id}/receive` endpoint for goods receipt
- Guaranteed invariant: `qty_total = qty_reserved + qty_available` for all StockItems
- StockItem quantities reflect real warehouse state

Consumes:
- nothing (first slice)

### S01 → S03

Produces:
- StockItem.qty_reserved and qty_available are always accurate
- ProjectItem.stock_item_id is populated when SKU matches warehouse

Consumes:
- nothing (first slice)

### S02 → S03

Produces:
- `backend/services/transition_service.py` with `can_transition_to(project, target_status, db) → (bool, reason)`
- ProjectItem.status reliably reflects true procurement stage (guaranteed by gating)
- ProjectStatusHistory table has complete audit trail
- Backend ProjectStatus enum is source of truth for status values

Consumes:
- S01 stock integrity (reserved quantities are correct)
- S01 write-off hook (called when transition to В производстве succeeds)
