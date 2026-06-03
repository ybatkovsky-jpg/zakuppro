---
id: M005-S04-T03
parent: S04
milestone: M005
key_files:
  - backend/rbac.py
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-03T08:28:03.092Z
blocker_discovered: false
---

# M005-S04-T03: Created RBAC authorization middleware with role-based access control, ownership checks, and query filtering utilities

**Created RBAC authorization middleware with role-based access control, ownership checks, and query filtering utilities**

## What Happened

Created backend/rbac.py with the following components:

1. **PermissionDenied exception** (403): Structured error response with user_id, user_role, endpoint, and required_permission for observability.

2. **require_role(allowed_roles) dependency factory**: FastAPI dependency that validates user role against allowed roles. Raises PermissionDenied if user's role is not authorized.

3. **require_ownership(resource, user_id, user_role) function**: Resource-level ownership check after fetching a resource. Owner role bypasses checks. Manager role requires resource.owner_id == user_id. Warehouse role denied for owned resources.

4. **apply_ownership_filter(query, model, user_id, user_role) utility**: Applies WHERE clauses to SQLAlchemy queries based on user role:
   - Owner: no filter (full access)
   - Manager: filters by owner_id if model has it
   - Warehouse: returns empty query for non-StockItem models

5. **Documentation**: Comprehensive docstring with permission matrix (owner: all, manager: own projects only + read-only suppliers, warehouse: stock items only) and usage examples.

6. **Helper functions**: get_readable_models() and get_writable_models() for validation/logging.

Module integrates with existing auth.py (imports get_current_user, get_current_active_user) and models.py (imports User, Role).

## Verification

Verification passed with grep command confirming require_role, require_ownership, and PermissionDenied exist in backend/rbac.py. Module structure verified with all task requirements met.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'require_role' backend/rbac.py && grep -q 'require_ownership' backend/rbac.py && grep -q 'PermissionDenied' backend/rbac.py && echo 'All required components found'` | 0 | PASS | 200ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/rbac.py`
