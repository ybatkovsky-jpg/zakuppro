# S04: Role-Based Access Control (RBAC) — UAT

**Milestone:** M005
**Written:** 2026-06-03T12:03:48.185Z

# S04 RBAC UAT

## UAT Type
Integration Test Suite (49 automated tests)

## Preconditions
- PostgreSQL database running with RBAC migration applied
- Test users created (owner, manager1, manager2, warehouse)
- FastAPI backend running on localhost:8000

## Test Scenarios

### TC1: Owner Full Access
**Steps:**
1. Login as owner user (username: owner_user, password: test)
2. Request GET /api/projects
3. Request GET /api/projects/{id}
4. Request POST /api/projects
5. Request PUT /api/projects/{id}
6. Request DELETE /api/projects/{id}
7. Request GET /api/stock-items
8. Request POST /api/stock-items
9. Request GET /api/suppliers
10. Request POST /api/suppliers
11. Request GET /api/analytics/dashboard

**Expected Outcomes:**
- All requests succeed (200/201)
- Owner sees all projects (including owned by managers)
- Owner has full CRUD access to all resources

**Evidence:** TestOwnerAccess (11 tests) - PASSED

### TC2: Manager Own Projects Only
**Steps:**
1. Login as manager1 (username: manager1_user, password: test)
2. Request GET /api/projects
3. Request GET /api/projects/1 (owned by manager1)
4. Request GET /api/projects/2 (owned by manager2)
5. Request POST /api/projects (creates project with manager1 as owner)
6. Request PUT /api/projects/1 (own project)
7. Request PUT /api/projects/2 (other manager's project)
8. Request DELETE /api/projects/1 (own project)
9. Request DELETE /api/projects/2 (other manager's project)
10. Request GET /api/suppliers (read-only)
11. Request POST /api/suppliers (attempt write)

**Expected Outcomes:**
- GET /api/projects returns only manager1's projects
- GET /api/projects/1 returns 200
- GET /api/projects/2 returns 403 Forbidden
- POST /api/projects succeeds with owner_id=manager1
- PUT /api/projects/1 returns 200
- PUT /api/projects/2 returns 403 Forbidden
- DELETE /api/projects/1 returns 200
- DELETE /api/projects/2 returns 403 Forbidden
- GET /api/suppliers returns 200 (read access)
- POST /api/suppliers returns 403 Forbidden (no write access)

**Evidence:** TestManagerAccess (14 tests) + TestCrossRoleIsolation (2 tests) - PASSED

### TC3: Warehouse Stock Items Only
**Steps:**
1. Login as warehouse (username: warehouse_user, password: test)
2. Request GET /api/stock-items
3. Request GET /api/stock-items/{id}
4. Request POST /api/stock-items (attempt create)
5. Request PUT /api/stock-items/{id} (attempt update)
6. Request DELETE /api/stock-items/{id} (attempt delete)
7. Request GET /api/projects (attempt access)
8. Request GET /api/suppliers (attempt access)
9. Request GET /api/analytics/dashboard (attempt access)

**Expected Outcomes:**
- GET /api/stock-items returns 200 (read access)
- GET /api/stock-items/{id} returns 200
- POST/PUT/DELETE /api/stock-items return 403 Forbidden
- GET /api/projects returns 403 Forbidden
- GET /api/suppliers returns 403 Forbidden
- GET /api/analytics/dashboard returns 403 Forbidden

**Evidence:** TestWarehouseAccess (9 tests) - PASSED

### TC4: 403 Response Format
**Steps:**
1. Login as warehouse
2. Request GET /api/projects (unauthorized endpoint)

**Expected Outcomes:**
- Response status: 403 Forbidden
- Response body includes:
  - error_code: "permission_denied"
  - user_role: "warehouse"
  - required_permission: List of allowed roles

**Evidence:** Test403ResponseFormat (3 tests) - PASSED

### TC5: No Auth Required
**Steps:**
1. Request GET /api/projects without Authorization header
2. Request GET /api/stock-items without Authorization header
3. Request GET /api/suppliers without Authorization header
4. Request GET /api/analytics/dashboard without Authorization header

**Expected Outcomes:**
- All requests return 401 Unauthorized
- Response includes detail: "Not authenticated"

**Evidence:** TestNoAuth (4 tests) - PASSED

### TC6: Login Validation
**Steps:**
1. Request POST /api/auth/login with valid credentials
2. Request POST /api/auth/login with invalid credentials

**Expected Outcomes:**
- Valid credentials: Returns 200 with JWT containing role claim
- Invalid credentials: Returns 401 Unauthorized

**Evidence:** TestLogin (4 tests) - PASSED

## Not Proven By This UAT
- Full UI integration (login page, role-based UI element hiding)
- Token refresh/expiration handling in UI
- Logout flow in frontend
- Role-based routing in Next.js app

These are deferred to future milestones as backend contract is proven.
