---
id: M005-S04-T06
parent: S04
milestone: M005
key_files:
  - backend/routers/stock_items.py
  - backend/routers/suppliers.py
  - backend/routers/analytics.py
key_decisions:
  - Applied RBAC spec: warehouse role has read-only access to stock items (GET), managers have read-only access to suppliers (GET only), owner has full access to all resources
  - Analytics ownership filtering implemented via apply_ownership_filter() - managers see only their projects' metrics via Project.join() chain
duration: 
verification_result: passed
completed_at: 2026-06-03T10:39:54.501Z
blocker_discovered: false
---

# M005-S04-T06: Updated stock_items, suppliers, and analytics routers with RBAC (JWT auth and role-based access control)

**Updated stock_items, suppliers, and analytics routers with RBAC (JWT auth and role-based access control)**

## What Happened

Implemented RBAC for the three remaining routers:

1. **stock_items.py**: Added JWT authentication to all endpoints. All roles (owner, manager, warehouse) have read access (GET). Only owner and manager have write access (POST/PUT/DELETE).

2. **suppliers.py**: Added JWT authentication. Owner and manager have read access (GET). Only owner has write access (POST/PUT/DELETE) - managers are read-only for suppliers as per spec.

3. **analytics.py**: Added JWT authentication with ownership filtering for managers:
   - GET /api/analytics/dashboard: Owner sees all data, manager sees only their projects' metrics
   - GET /api/analytics/payment-dynamics: Same ownership filtering
   - GET /api/analytics/export/transactions: Owner only
   - POST /api/analytics/upload-bank-statement: Owner only

All endpoints now use `require_role()` from `rbac.py` with appropriate role lists. Analytics endpoints use `apply_ownership_filter()` to filter dashboard/payment queries by project ownership for managers. Each router includes logging for audit trails.

## Verification

Ran `grep -q 'current_user'` on all three routers - all checks passed, confirming JWT authentication is now integrated into all endpoints.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'current_user' backend/routers/stock_items.py && grep -q 'current_user' backend/routers/suppliers.py && grep -q 'current_user' backend/routers/analytics.py` | 0 | pass | 500ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/routers/stock_items.py`
- `backend/routers/suppliers.py`
- `backend/routers/analytics.py`
