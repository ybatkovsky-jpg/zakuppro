---
estimated_steps: 23
estimated_files: 8
skills_used: []
---

# T01: Add RBAC guards to 6 unprotected routers + GET /users/me + integration tests

Why: 6 backend routers (purchase_orders, invoices, payments, project_items, production_tasks, unresolved_transactions) currently accept any request without authentication — all data is exposed. The RBAC framework (require_role, require_ownership, apply_ownership_filter) is already built and proven on projects, suppliers, stock_items, and analytics routers. This task applies the same patterns to close the security gap. Also adds GET /users/me so the frontend can hydrate user info on app load.

Do:
1. Add imports to each router: `from backend.models import User, Role` and `from backend.rbac import require_role, require_ownership, apply_ownership_filter`
2. Add `current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER]))` to every endpoint in all 6 routers
3. For list endpoints on entities with project ownership chain, apply ownership filtering through joins:
   - purchase_orders: join PurchaseOrder.project, filter on Project.owner_id
   - invoices: join Invoice.purchase_order → PurchaseOrder.project, filter on Project.owner_id
   - payments: join Payment.invoice → Invoice.purchase_order → PurchaseOrder.project, filter on Project.owner_id
   - project_items: join ProjectItem.project, filter on Project.owner_id
   - production_tasks: join ProductionTask.project, filter on Project.owner_id
   - unresolved_transactions: no ownership path exists — restrict to owner/manager only (no per-user filtering)
4. For single-resource GET/PUT/DELETE endpoints, add require_ownership() check after fetching resource (skip for unresolved_transactions — role-gate only)
5. For POST endpoints on entities with project FK, set ownership context from the linked project
6. Add `GET /users/me` to backend/routers/auth.py: returns current user's id, username, email, role from the authenticated User dependency
7. Extend backend/tests/test_rbac_integration.py:
   - Extend test fixture to create: purchase_order (linked to project1), invoice (linked to purchase_order), payment (linked to invoice), project_item (linked to project1), production_task (linked to project1), unresolved_transaction
   - Add TestNoAuth tests for each new router (verify 401 without token)
   - Add TestOwnerAccess tests for each new router (verify 200 with owner token)
   - Add TestWarehouseAccess tests for each new router (verify 403 with warehouse token)
   - Add TestManagerAccess tests: manager sees only own resources through ownership chain
   - Add test for GET /users/me returning correct user info
   - Add cross-role isolation tests: manager1 cannot see manager2's purchase_orders/invoices/payments

Done when: `cd backend && python -m pytest tests/test_rbac_integration.py -v` passes all tests (existing + new), and all 6 routers return 401 for unauthenticated requests.

## Inputs

- `backend/rbac.py`
- `backend/auth.py`
- `backend/models.py`
- `backend/routers/projects.py`
- `backend/routers/suppliers.py`
- `backend/routers/stock_items.py`
- `backend/routers/analytics.py`
- `backend/routers/purchase_orders.py`
- `backend/routers/invoices.py`
- `backend/routers/payments.py`
- `backend/routers/project_items.py`
- `backend/routers/production_tasks.py`
- `backend/routers/unresolved_transactions.py`
- `backend/routers/auth.py`
- `backend/tests/test_rbac_integration.py`
- `backend/tests/conftest.py`

## Expected Output

- `backend/routers/purchase_orders.py`
- `backend/routers/invoices.py`
- `backend/routers/payments.py`
- `backend/routers/project_items.py`
- `backend/routers/production_tasks.py`
- `backend/routers/unresolved_transactions.py`
- `backend/routers/auth.py`
- `backend/tests/test_rbac_integration.py`

## Verification

cd backend && python -m pytest tests/test_rbac_integration.py -v

## Observability Impact

Structured 401/403 error responses (PERMISSION_DENIED error_code, user_role, required_permission) on all 6 routers. Ownership filtering failures surface as empty result sets (list) or 403 (single resource). Future agent can diagnose any auth failure by inspecting the JSON response body.
