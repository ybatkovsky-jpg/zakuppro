---
estimated_steps: 10
estimated_files: 3
skills_used: []
---

# T02: Build stock_service.py with three core primitives and add receive endpoint

Why: stock_service.py is the single entry point for all stock mutations, enforcing the invariant qty_total = qty_reserved + qty_available at the service layer (per MEM105). The receive endpoint gives warehouse operators a way to record incoming goods.

Do:
1. Create `backend/services/stock_service.py` with three functions:
   - `reserve_for_project(project_id, db)`: Query all ProjectItems for the project. For each item with a SKU, find matching StockItem by SKU. If match found and stock_item_id not already set, set it. If qty_available >= project_item.qty, reserve the full qty (increase qty_reserved, decrease qty_available). If insufficient, reserve partial (what's available) and log warning. Validate invariant after each reservation.
   - `write_off_for_production(project_id, db)`: For all reserved StockItems linked to project's ProjectItems, decrease qty_total and qty_reserved by the ProjectItem.qty. qty_available unchanged (already reduced by reserve). Validate invariant after each write-off.
   - `receive_stock(stock_item_id, qty, db)`: Increase both qty_total and qty_available by qty. qty_reserved unchanged. Validate invariant.
   - Each function logs structured INFO messages with entity IDs, quantities, and operation result.
   - Invariant check: `assert stock_item.qty_total == stock_item.qty_reserved + stock_item.qty_available` after every mutation; raise ValueError with descriptive message if violated.
2. Add `POST /api/stock-items/{id}/receive` endpoint to `backend/routers/stock_items.py`. RBAC: owner + manager + warehouse (per D036 decision). Accepts `StockReceiveRequest` body, calls `receive_stock()`, returns updated StockItemResponse. Import the new schema.

Done when: Module imports cleanly, all three functions can be called with a db session, receive endpoint returns correct response shape when called with valid auth.

## Inputs

- `backend/models.py`
- `backend/schemas.py`
- `backend/routers/stock_items.py`
- `backend/rbac.py`
- `backend/database.py`

## Expected Output

- `backend/services/stock_service.py`

## Verification

cd backend && python -c "from backend.services.stock_service import reserve_for_project, write_off_for_production, receive_stock; print('All functions importable')" && python -c "from backend.routers.stock_items import router; print('Router has receive endpoint')"

## Observability Impact

Every stock mutation logs structured INFO with operation, entity IDs, and quantities. Invariant violations raise ValueError with descriptive message — a future agent can grep logs for 'invariant violated' to detect data corruption.
