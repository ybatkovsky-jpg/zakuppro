---
estimated_steps: 28
estimated_files: 9
skills_used: []
---

# T03: Implement remaining 8 entity routers

## Why
Complete the CRUD surface for all entities following the Project pattern. StockItem, Supplier, ProjectItem are high-priority; PurchaseOrder, Invoice, Payment, UnresolvedTransaction, ProductionTask complete the set.

## Do
1. Create routers following Project pattern:
   - `backend/routers/project_items.py`
   - `backend/routers/suppliers.py`
   - `backend/routers/stock_items.py`
   - `backend/routers/purchase_orders.py`
   - `backend/routers/invoices.py`
   - `backend/routers/payments.py`
   - `backend/routers/unresolved_transactions.py`
   - `backend/routers/production_tasks.py`
2. Each router implements: GET list, GET detail, POST create, PUT update, DELETE delete
3. Use selectinload for relationships:
   - ProjectItem: eager-load supplier, stock_item
   - PurchaseOrder: eager-load project
   - Invoice: eager-load purchase_order
   - Payment: eager-load invoice
4. Include all routers in main.py

## Constraints
- Follow exact same endpoint structure as Project router
- Use appropriate schemas (Create/Update/Response) from schemas.py
- Foreign key constraints will enforce referential integrity (409 on violations)
- RESTRICT on supplier delete will fail if purchase_orders exist

## Done when
All 9 routers included in main.py
Swagger UI shows all 45 endpoints (5 per entity)
Each router file follows Project pattern

## Inputs

- `backend/models.py`
- `backend/schemas.py`
- `backend/database.py`
- `backend/routers/projects.py`
- `backend/main.py`

## Expected Output

- `backend/routers/project_items.py`
- `backend/routers/suppliers.py`
- `backend/routers/stock_items.py`
- `backend/routers/purchase_orders.py`
- `backend/routers/invoices.py`
- `backend/routers/payments.py`
- `backend/routers/unresolved_transactions.py`
- `backend/routers/production_tasks.py`
- `backend/main.py`

## Verification

python -c "
from backend.main import app
routes = [r.path for r in app.routes]
entity_count = sum(1 for r in routes if '/api/' in r)
print(f'API routes: {entity_count}')
assert entity_count >= 45, f'Expected 45+ routes, got {entity_count}'
"
grep -c 'include_router' backend/main.py

## Observability Impact

All entities expose CRUD surface; SQL logs show query patterns with eager loading.
