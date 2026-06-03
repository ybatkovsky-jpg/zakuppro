# S04: Role-Based Access Control (RBAC) - Research

## Scope Overview

Slice S04 implements basic Role-Based Access Control (RBAC) for the ZakupPro application. The goal is to restrict data access based on user roles:
- **owner**: Full access to all entities
- **manager**: Access only to their own projects
- **warehouse**: Access only to warehouse (StockItem) endpoints

Unauthorized access attempts should return HTTP 403 Forbidden.

## Existing Infrastructure Analysis

### Backend Authentication Setup

**JWT Libraries Already Installed:**
- `python-jose[cryptography]==3.3.0` - JWT token creation/validation
- `passlib[bcrypt]==1.7.4` - Password hashing (if needed for future user auth)

**Current Authentication State:**
- **No authentication middleware exists** in `backend/main.py`
- All routers use `Depends(get_db)` for database session injection
- No JWT token validation or user context extraction
- No User model or role-based filtering in queries

**Frontend Auth Support:**
- `src/lib/api-client.ts` already supports `FASTAPI_AUTH_TOKEN` environment variable
- Bearer token is added to Authorization header if configured:
  ```typescript
  if (FASTAPI_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${FASTAPI_AUTH_TOKEN}`;
  }
  ```

### Decision D031 Context

From the milestone decisions, the chosen approach is:
> **RBAC с JWT токенами и role claim**
> Роль пользователя хранится в JWT токене как claim, проверяется middleware на endpoint. JWT токен уже используется для аутентификации. Добавление role claim позволяет авторизовать запросы без дополнительного DB lookup. Middleware проверяет permission декларативно по endpoint pattern.

**Key constraint:** This decision assumes JWT authentication is already in place, but our codebase has **no JWT implementation yet**.

### Database Models (No User/Role Tables)

**Current Models (`backend/models.py`):**
- Project, ProjectItem, Supplier, StockItem, PurchaseOrder, Invoice, Payment, etc.
- **No User model exists**
- **No Role enum/table exists**
- Projects have no `owner_id` or `user_id` field for associating with managers

**Gap Analysis:**
1. Need to create User model with role field
2. Need to add `owner_id`/`manager_id` to Project model for tracking ownership
3. Need migration script for new tables/columns

### Current Router Patterns

**Existing Router Structure (e.g., `backend/routers/projects.py`):**
```python
@router.get("/", response_model=List[ProjectResponse])
def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects
```

**No Current Filtering:**
- All endpoints return full data without user context
- No WHERE clauses for ownership or role-based filtering

## Implementation Approach

### Backend Implementation

**1. Create User and Role Models**
- Add `User` model to `backend/models.py`:
  - `id`, `username`, `email`, `hashed_password`, `role`
- Add `owner_id` foreign key to `Project` model
- Create Alembic migration for schema changes
- Define `Role` enum: `owner`, `manager`, `warehouse`

**2. JWT Authentication Dependencies**
- Create `backend/auth.py` module with:
  - `create_access_token()` - generates JWT with role claim
  - `verify_token()` - validates JWT and extracts user_id/role
  - `get_current_user()` dependency for endpoint injection
- Add `SECRET_KEY` and `ALGORITHM` to environment/config

**3. Authorization Middleware**
- Create `backend/rbac.py` with permission decorators:
  - `require_role()` - endpoint-level role check
  - `require_ownership()` - resource ownership validation
- Update `backend/main.py` to include auth dependencies

**4. Update Routers with RBAC**
- Modify each router to accept `current_user` dependency
- Add WHERE clauses based on user role:
  - `owner`: no filtering
  - `manager`: `WHERE owner_id = current_user.id`
  - `warehouse`: only allow StockItem endpoints, return 403 for others

**5. Endpoint Permission Matrix**
| Endpoint | owner | manager | warehouse |
|----------|-------|---------|-----------|
| GET /api/projects | all | own only | 403 |
| GET /api/projects/{id} | all | own only | 403 |
| POST/PUT/DELETE /api/projects | all | own only | 403 |
| GET /api/warehouse | all | read-only | all |
| GET /api/suppliers | all | read-only | 403 |
| GET /api/analytics/* | all | own metrics only | 403 |

### Frontend Integration

**1. Type Extensions**
- Update `src/types/fastapi.ts` with User types:
  ```typescript
  export interface User {
    id: number;
    username: string;
    role: 'owner' | 'manager' | 'warehouse';
  }
  ```

**2. Login Flow**
- Create login API route: `POST /api/auth/login`
- Frontend stores JWT token in localStorage/cookie
- Update `api-client.ts` to read token from storage

**3. Route-Level Access Control**
- Create `src/lib/rbac.ts` with permission helpers
- Add middleware to Next.js pages to redirect unauthorized access
- Hide UI elements based on user role

### Database Migration Strategy

**Migration Steps:**
1. Create `backend/alembic/versions/xxx_add_rbac_models.py`
2. Add `users` table with role column
3. Add `owner_id` column to `projects` table
4. Backfill existing projects with default owner (e.g., user_id=1)
5. Create seed script for initial owner user

## Key Files to Modify

**Backend (New):**
- `backend/auth.py` - JWT token creation/verification
- `backend/rbac.py` - Role-based permission decorators
- `backend/models.py` - Add User model, owner_id to Project

**Backend (Modified):**
- `backend/main.py` - Include auth/rbac dependencies
- `backend/routers/projects.py` - Add ownership filtering
- `backend/routers/stock_items.py` - Add warehouse role handling
- `backend/routers/suppliers.py` - Add role-based read/write checks
- `backend/routers/analytics.py` - Filter by ownership

**Frontend (New):**
- `src/types/fastapi.ts` - Add User, LoginRequest, LoginResponse types
- `src/lib/rbac.ts` - Permission helpers for frontend
- `src/app/api/auth/login/route.ts` - Login proxy to FastAPI

**Frontend (Modified):**
- `src/lib/api-client.ts` - Auto-include JWT from storage
- Project UI pages - Hide/show based on role

## Verification Strategy

**Backend Tests:**
1. Test JWT creation and validation
2. Test each endpoint with different role tokens
3. Verify 403 responses for unauthorized access
4. Verify ownership filtering (manager sees only own projects)

**Frontend Tests:**
1. Test login flow stores token
2. Test API requests include Authorization header
3. Test UI redirects based on role
4. Test warehouse user sees only warehouse pages

**Integration Tests:**
1. Create users with different roles
2. Log in as each role
3. Attempt CRUD operations and verify results
4. Verify manager cannot access other manager's projects

## Risks and Considerations

**High Risk Areas:**
1. **No existing User model** - need to design from scratch
2. **No existing auth flow** - full JWT implementation needed
3. **Project ownership undefined** - existing projects have no owner
4. **Frontend auth state** - no current login/logout UI

**Medium Risk Areas:**
1. **Token refresh** - not in scope but may be needed
2. **Password management** - passlib installed but no password reset flow
3. **Analytics filtering** - complex queries for manager-specific metrics

**Decisions Needed:**
1. How to seed initial owner user?
2. Should login use username+password or API key?
3. Token expiration time?
4. Where to store JWT on frontend (localStorage vs httpOnly cookie)?

## Implementation Order Recommendation

1. **Backend auth infrastructure** (auth.py, rbac.py, models)
2. **Database migration** (users table, owner_id)
3. **Login endpoint** (/api/auth/login)
4. **Update one router as proof-of-concept** (projects.py)
5. **Frontend login flow and token storage**
6. **Update remaining routers with RBAC**
7. **Frontend role-based UI hiding**
8. **Integration testing**

## Dependencies on Other Slices

**From S01:**
- API client pattern established - JWT token integration follows same pattern
- TypeScript types follow existing fastapi.ts conventions

**To S05 (Production Readiness):**
- RBAC must be complete before Docker Compose deployment
- Environment variables for SECRET_KEY must be documented

## Open Questions

1. Should we implement password-based login or API key authentication?
2. How do we handle the "manager only sees own projects" requirement when existing projects have no owner?
3. Should warehouse role have read-only access to suppliers (for creating stock items)?
4. Token expiration: short-lived (1 hour) or long-lived (30 days)?
