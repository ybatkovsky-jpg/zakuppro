# S01: Stock Reservation Engine — UAT

**Milestone:** M006
**Written:** 2026-06-04T09:43:13.537Z

# UAT: Stock Reservation Engine (S01)

## UAT Type
Backend API integration + service-layer correctness

## Preconditions
1. Database is migrated to latest (includes migration 145abfb476cb for project_status_history table)
2. At least one StockItem exists with known SKU, qty_total > 0
3. An authenticated user with owner role (to create projects and trigger transitions)
4. Warehouse operator or owner (for receive endpoint)

## UAT Scenarios

### TC1: Auto-reservation on ProjectItem creation
**Steps:**
1. Note the StockItem's initial qty_reserved and qty_available values
2. Create a Project via POST /api/projects/
3. Create a ProjectItem via POST /api/projects/{id}/items with SKU matching the StockItem
4. GET /api/stock-items/{id} and check updated quantities

**Expected:** qty_reserved increased by ProjectItem.qty, qty_available decreased by same amount, qty_total unchanged. Invariant qty_total == qty_reserved + qty_available holds.

### TC2: Write-off on production transition
**Steps:**
1. Have a project with reserved ProjectItems (from TC1)
2. PUT /api/projects/{id} with `{"status": "В производстве"}`
3. GET /api/stock-items/{linked_stock_item_id}

**Expected:** qty_total decreased by ProjectItem.qty, qty_reserved decreased by same amount, qty_available unchanged. Invariant holds.

### TC3: Goods receipt via receive endpoint
**Steps:**
1. POST /api/stock-items/{id}/receive with `{"qty": 50}`
2. GET /api/stock-items/{id}

**Expected:** qty_total increased by 50, qty_available increased by 50, qty_reserved unchanged. Invariant holds.

### TC4: Status history audit trail
**Steps:**
1. Create a project with status "Новый"
2. PUT status to "К закупке"
3. PUT status to "В производстве"
4. Query project_status_history table

**Expected:** Three records exist with correct from_status → to_status transitions and timestamps.

### TC5: Partial reservation with mismatched qty
**Steps:**
1. Have a StockItem with qty_available=3, qty_reserved=0
2. Create a ProjectItem with same SKU, qty=10

**Expected:** qty_reserved increases by only 3 (max available), qty_available becomes 0. Warning log emitted. Invariant holds. ProjectItem.stock_item_id is set to the StockItem.

### TC6: Invariant enforced (safety net)
**Steps:**
1. Directly corrupt a StockItem in DB: set qty_total=100, qty_reserved=30, qty_available=60 (broken invariant)
2. Trigger any stock mutation on this item

**Expected:** ValueError raised with descriptive message including the computed remainder.

## Edge Cases
- ProjectItem with no SKU: reservation skips it (no-op)
- ProjectItem SKU not matching any StockItem: reservation skips it
- Receive with qty=0: rejected with 422 (Pydantic validation)
- Receive with negative qty: rejected with 422
- Receive for nonexistent stock item: 404
- Write-off with no reserved items: no-op (silent)
- Multiple ProjectItems linking to same StockItem: quantities summed correctly
- Concurrent status changes: handled by SQLAlchemy session isolation

## Not Proven By This UAT
- Kanban drag-and-drop guardrail (S02 responsibility)
- Per-project readiness color indicator (S03 responsibility)
- Frontend UI integration (S05 responsibility)
