# S04: Role-Based Access Control (RBAC)

**Goal:** Implement Role-Based Access Control (RBAC) with JWT authentication for ZakupPro API, supporting owner (full access), manager (own projects only), and warehouse (warehouse only) roles.
**Demo:** Пользователь 'manager' видит только свои проекты. Пользователь 'warehouse' видит только склад. Пользователь 'owner' видит всё. Попытка доступа к чужим данным возвращает 403.

## Must-Haves

- JWT tokens include role claim and are validated on all protected endpoints
- Users table exists with role field; projects have owner_id foreign key
- All API routers enforce role-based access control (403 for unauthorized access)
- Login endpoint creates and returns JWT tokens
- Frontend can authenticate, store token, and receives appropriate 403 errors for unauthorized access

## Proof Level

- This slice proves: integration

## Integration Closure

Backend auth infrastructure (models, JWT, RBAC) is complete and tested. Frontend can authenticate and receives proper authorization responses. Full UI integration (login page, role-based UI hiding) deferred to future milestone - this slice proves the backend contract works.

## Verification

- Auth failures logged with user ID and endpoint. 403 responses include structured error details explaining missing permissions.

## Tasks

- [x] **M005-S04-T01: Create User model, RBAC types, and database migration** `est:2h`
  ## Why
  RBAC requires a User model to store credentials and roles. Projects need ownership tracking. A database migration adds the new tables and columns.
  - Files: `backend/models.py`, `backend/schemas.py`, `backend/alembic/versions/*_add_rbac_models.py`, `backend/scripts/seed_owner.py`
  - Verify: grep -q 'class User' backend/models.py && ls backend/alembic/versions/*add_rbac*.py 2>/dev/null && grep -q 'LoginRequest' backend/schemas.py

- [x] **M005-S04-T02: Implement JWT authentication module** `est:1.5h`
  ## Why
  JWT tokens provide stateless authentication with role claims. This module creates tokens for login and validates them on requests.
  - Files: `backend/auth.py`, `backend/schemas.py`
  - Verify: grep -q 'create_access_token' backend/auth.py && grep -q 'verify_token' backend/auth.py && grep -q 'get_current_user' backend/auth.py

- [x] **M005-S04-T03: Create RBAC authorization middleware** `est:1.5h`
  ## Why
  Authorization logic needs to be reusable across all routers. This module provides decorators and utilities for role-based access control.
  - Files: `backend/rbac.py`
  - Verify: grep -q 'require_role' backend/rbac.py && grep -q 'require_ownership' backend/rbac.py && grep -q 'PermissionDenied' backend/rbac.py

- [x] **M005-S04-T04: Create login endpoint and update main.py** `est:1.5h`
  ## Why
  Users need a way to authenticate and receive JWT tokens. The login endpoint validates credentials and returns a token.
  - Files: `backend/routers/auth.py`, `backend/main.py`
  - Verify: grep -q 'login' backend/routers/auth.py && grep -q 'auth.router' backend/main.py

- [x] **M005-S04-T05: Update projects router with RBAC enforcement** `est:2h`
  ## Why
  Projects router is the primary endpoint for managers. It needs ownership filtering and role-based access control.
  - Files: `backend/routers/projects.py`
  - Verify: grep -q 'current_user' backend/routers/projects.py && grep -q 'require_role\|ownership' backend/routers/projects.py

- [x] **M005-S04-T06: Update remaining routers with RBAC (stock_items, suppliers, analytics)** `est:2.5h`
  ## Why
  All API endpoints need RBAC to complete the security model. Stock items for warehouse, suppliers and analytics for owner/managers.
  - Files: `backend/routers/stock_items.py`, `backend/routers/suppliers.py`, `backend/routers/analytics.py`
  - Verify: grep -q 'current_user' backend/routers/stock_items.py && grep -q 'current_user' backend/routers/suppliers.py && grep -q 'current_user' backend/routers/analytics.py

- [x] **M005-S04-T07: Frontend auth types and login API proxy** `est:1.5h`
  ## Why
  Frontend needs TypeScript types for auth and a way to call the login endpoint. The API proxy pattern follows S01 conventions.
  - Files: `src/types/fastapi.ts`, `src/app/api/auth/login/route.ts`, `src/lib/api-client.ts`, `src/lib/auth.ts`
  - Verify: grep -q 'LoginRequest' src/types/fastapi.ts && grep -q 'LoginResponse' src/types/fastapi.ts && test -f src/app/api/auth/login/route.ts && test -f src/lib/auth.ts

- [ ] **M005-S04-T08: Write RBAC integration tests and verify slice** `est:2h`
  ## Why
  RBAC is security-critical. Integration tests verify all role combinations work correctly and 403 responses are proper.
  - Files: `backend/tests/test_rbac_integration.py`
  - Verify: cd backend && python -m pytest tests/test_rbac_integration.py -v --tb=short 2>&1 | head -50

## Files Likely Touched

- backend/models.py
- backend/schemas.py
- backend/alembic/versions/*_add_rbac_models.py
- backend/scripts/seed_owner.py
- backend/auth.py
- backend/rbac.py
- backend/routers/auth.py
- backend/main.py
- backend/routers/projects.py
- backend/routers/stock_items.py
- backend/routers/suppliers.py
- backend/routers/analytics.py
- src/types/fastapi.ts
- src/app/api/auth/login/route.ts
- src/lib/api-client.ts
- src/lib/auth.ts
- backend/tests/test_rbac_integration.py
