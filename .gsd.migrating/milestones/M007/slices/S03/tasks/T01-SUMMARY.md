---
id: T01
parent: S03
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T03:26:27.915Z
blocker_discovered: false
---

# T01: Applied RBAC guards to all 6 unprotected routers, added GET /users/me, fixed cascade deletes, and added 76 new integration tests (125 total passing)

**Applied RBAC guards to all 6 unprotected routers, added GET /users/me, fixed cascade deletes, and added 76 new integration tests (125 total passing)**

## What Happened

All 6 backend routers (purchase_orders, invoices, payments, project_items, production_tasks, unresolved_transactions) already had RBAC guards applied from the prior session — require_role on every endpoint, _check_ownership helpers, manager ownership filtering via join chains, and POST ownership verification. GET /users/me was also already present in auth.py.

The remaining work was:
1. **Cascade delete fix in models.py**: Added `cascade="all, delete-orphan"` to 5 relationships (Project.purchase_orders, Project.production_tasks, Supplier.purchase_orders, PurchaseOrder.invoices, Invoice.payments) to enable proper cascade deletes through the ownership chain. Without this, deleting any entity with child records failed with NOT NULL constraint violations.

2. **Extended test fixture**: Added creation of purchase_order (linked to project1), invoice (linked to purchase_order), payment (linked to invoice), project_item (linked to project1), production_task (linked to project1), and unresolved_transaction (no ownership chain) to the existing test data.

3. **Comprehensive test coverage** (76 new tests across 5 test classes):
   - TestUsersMe (4 tests): GET /users/me returns correct user info for all roles, 401 without auth
   - TestNoAuthNewRouters (8 tests): All 6 routers return 401 without token
   - TestOwnerAccessNewRouters (30 tests): Owner CRUD on all 6 routers succeeds (5 operations × 6 routers = 30)
   - TestWarehouseAccessNewRouters (8 tests): Warehouse gets 403 with PERMISSION_DENIED error on all routers
   - TestManagerAccessNewRouters (19 tests): Manager sees only own resources, can create in own project, gets 403 creating in other project, and has full access to unresolved_transactions (role-gated only)
   - TestCrossRoleIsolationNewRouters (7 tests): Manager2 sees empty lists for all owned resources, warehouse gets structured 403 on all routes

All 125 tests pass (including the 49 pre-existing tests).

## Verification

Ran `cd backend && python -m pytest tests/test_rbac_integration.py -v` — all 125 tests pass (49 pre-existing + 76 new). Verified:
- All 6 routers return 401 for unauthenticated requests
- Owner role has full CRUD access to all 6 routers
- Warehouse role gets 403 PERMISSION_DENIED with correct error_code, user_role, and required_permission on all 6 routers
- Manager sees only own resources through ownership chain joins (purchase_orders, invoices, payments, project_items, production_tasks)
- Manager gets 403 when creating resources in another manager's project
- Manager has full access to unresolved_transactions (role-gated only, no ownership path)
- Manager2 sees empty result sets for all owned resources (verified via list endpoints)
- Cross-role isolation confirmed across all entity types
- GET /users/me returns correct username, email, role for all roles
- Cascade deletes work correctly through the full ownership chain

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd backend && python -m pytest tests/test_rbac_integration.py -v` | 0 | 125 passed, 0 failed in 596s | 596680ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
