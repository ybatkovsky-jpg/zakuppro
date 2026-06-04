# S03 Research: Role-Based Access in Web UI

## Summary

The backend already has a complete RBAC infrastructure (Role enum, JWT role claims, `require_role` dependency, `require_ownership` checker, `apply_ownership_filter` query helper) but several routers are still unprotected. The frontend has auth utilities (`login`/`logout`/`getUserRole` in localStorage) and TypeScript types but **no actual role-based UI**: no login page, no auth context, no role-aware routing, no sidebar filtering, and no element-level permission gating. This slice must wire up the frontend to consume the backend RBAC and add missing backend guards.

## Requirements Coverage

- **R018**: Currently partially met. Backend has the RBAC framework and enforces it on projects, stock-items, suppliers, and analytics. Frontend has `UserRole` type and `getUserRole()` utility but does NOT restrict navigation, page access, or UI elements by role.

## Implementation Landscape

### Current Auth Architecture

**Backend** (`backend/auth.py`, `backend/rbac.py`, `backend/models.py`):
- `User` model has `role` column (Enum: `owner`, `manager`, `warehouse`), default `MANAGER`
- JWT tokens carry `user_id` and `role` claims (via `create_access_token()`)
- `get_current_user()` dependency decodes token, queries DB, returns `User` object
- `require_role([Role.OWNER, ...])` dependency factory returns 403 if role not allowed
- `require_ownership(resource, user_id, user_role)` checks `resource.owner_id == user_id` (owner role bypasses)
- `apply_ownership_filter(query, model, user_id, user_role)` adds WHERE clause to SQLAlchemy queries
- Login endpoint (`POST /api/auth/login`) validates password, returns JWT with role

**Frontend** (`src/lib/auth.ts`, `src/lib/api-client.ts`, `src/types/fastapi.ts`):
- `login()` calls Next.js proxy route -> FastAPI, stores token + role in localStorage
- `logout()` clears localStorage
- `getUserRole()` reads role from localStorage
- `isAuthenticated()` checks for token in localStorage
- API client (`apiFetch`) automatically attaches `Authorization: Bearer <token>` header
- Types define `UserRole = 'owner' | 'manager' | 'warehouse'` and `User` interface with `role`
- **No React context** for auth state -- components would need to call `getUserRole()` directly from localStorage (brittle, no reactivity)

### Files to Touch

**Backend** (add RBAC guards to unprotected routers):

| File | Purpose |
|------|---------|
| `backend/routers/purchase_orders.py` | Add `require_role` and ownership filtering to all CRUD endpoints |
| `backend/routers/invoices.py` | Add `require_role` and ownership filtering to all CRUD endpoints |
| `backend/routers/payments.py` | Add `require_role` and ownership filtering to all CRUD endpoints |
| `backend/routers/project_items.py` | Add `require_role` and ownership filtering to all CRUD endpoints |
| `backend/routers/production_tasks.py` | Add `require_role` and ownership filtering to all CRUD endpoints |
| `backend/routers/unresolved_transactions.py` | Add `require_role` (owner/manager only) |
| `backend/routers/auth.py` | Consider adding `GET /users/me` endpoint (returns current user with role) |

**Frontend** (build role-aware UI layer):

| File | Purpose |
|------|---------|
| `src/components/providers/auth-provider.tsx` | **NEW** -- React context providing `user`, `role`, `login`, `logout` to entire app |
| `src/components/app/login-page.tsx` | **NEW** -- Login page/component with username/password form |
| `src/app/page.tsx` | Add auth-gated routing: redirect unauthenticated to login, pass role to sidebar |
| `src/components/app/app-sidebar.tsx` | Filter navigation items by role (warehouse sees only "Sklad" + "Dashboard"; manager excludes admin-only items) |
| `src/store/app-store.ts` | Add `userRole` and `isAuthenticated` to zustand store (or rely on context) |
| `src/lib/auth.ts` | Possibly refactor to use provider instead of raw localStorage |
| `src/components/app/warehouse.tsx` | Ensure stock list is accessible for warehouse role; hide create/edit buttons unless owner/manager |
| `src/components/app/projects.tsx` | Ensure project list works for managers (own projects only via API filter) |
| `src/components/app/dashboard.tsx` | Hide warehouse section from non-warehouse, hide analytics from warehouse |
| `src/components/app/invoices.tsx` | Hide from warehouse role entirely |
| `src/components/app/analytics.tsx` | Already backend-guarded; frontend should also hide for warehouse |
| `src/components/app/suppliers.tsx` | Hide create/edit/delete buttons from manager role |

### Natural Seams (Independent Work Units)

1. **Unit A: Backend router audit** -- Add `require_role` + ownership filtering to the 6 unprotected routers (purchase_orders, invoices, payments, project_items, production_tasks, unresolved_transactions). Add `GET /users/me` endpoint. Verify with existing test patterns.

2. **Unit B: Frontend auth provider + login page** -- Create `AuthProvider` context wrapping the app, create LoginPage component, wire `page.tsx` to gate access (show login if no token, show app if authenticated). Add `GET /users/me` call on app load to hydrate user info.

3. **Unit C: Frontend role-aware sidebar and routing** -- Filter the sidebar nav items by role (warehouse sees only "Dashboard" + "Sklad"; manager sees everything except admin-only). Guard route rendering in `AppContent` against unauthorized views.

4. **Unit D: Frontend per-component role gating** -- Add conditional rendering in individual page components: hide create/edit/delete buttons from unauthorized roles; hide sections that are not relevant (hide warehouse section from manager/owner in dashboard, hide invoices from warehouse, etc.)

### First Proof

**Highest risk item**: The frontend auth provider + login page. Currently the frontend has no authentication gating at all -- the SPA renders immediately. If the auth provider or token check fails, the entire UI becomes inaccessible. This should be built and verified first, ideally against the existing `POST /api/auth/login` backend endpoint. Unit A (backend router audit) is lower risk since the RBAC patterns are well-established in `projects.py` and `suppliers.py`.

**Verification approach**: 
1. Hit `POST /api/auth/login` with owner credentials -- get JWT
2. Call `GET /api/projects/` with token -- expect 200 + all projects
3. Call `GET /api/stock-items/` with token -- expect 200
4. Frontend: verify login form appears when no token
5. Frontend: verify app renders after login with correct sidebar items for each role

## Key Findings

### What Exists

- Complete backend RBAC framework (`rbac.py`): `require_role()`, `require_ownership()`, `apply_ownership_filter()`, `PermissionDenied`
- Role enum and User model with `role` column (with DB migration `rbac_models_add_rbac.py`)
- JWT tokens include `user_id` and `role` claims
- 4 routers already have RBAC: `projects.py`, `stock_items.py`, `suppliers.py`, `analytics.py`
- Comprehensive RBAC integration tests (`test_rbac_integration.py`) covering all three roles
- Frontend TypeScript types: `UserRole`, `User`, `LoginRequest`, `LoginResponse`
- Frontend auth utilities: `login()`, `logout()`, `isAuthenticated()`, `getUserRole()`, `getUserId()`, `getUsername()`
- Frontend API client: auto-attaches JWT from localStorage
- Seed script: `seed_owner.py` creates default admin/owner user

### What's Missing

- 6 backend routers have NO authentication at all (any unauthenticated request succeeds)
- Frontend has NO auth provider/context (no React state for auth; components must read localStorage directly)
- Frontend has NO login page (no UI for entering credentials)
- Frontend has NO route protection (the SPA renders regardless of auth state)
- Frontend has NO role-aware sidebar filtering (warehouse role sees "Proekty", "Scheta", etc.)
- Frontend has NO role-aware element visibility (warehouse role would see create/edit buttons they cannot use)
- Frontend has NO `GET /users/me` flow to hydrate user info on page load
- No admin/DLQ page for owner role (future M007 slice)

### Access Matrix

| Role | Projects | Stock Items | Suppliers | Invoices/Payments/PO | Analytics | Settings |
|------|----------|-------------|-----------|---------------------|-----------|----------|
| Owner | All CRUD | All CRUD | All CRUD | All CRUD | All | All |
| Manager | Own only CRUD | Read + receive | Read-only | Own only CRUD | Own only | Limited |
| Warehouse | None | Read + receive | None | None | None | None |

### Constraints

- Ownership model uses `Project.owner_id` -- not all entities (Invoice, Payment, PurchaseOrder) have a direct `owner_id` field. Filtering these requires joining through the project chain: `Invoice -> PurchaseOrder -> Project -> owner_id`. The existing `apply_ownership_filter` in `analytics.py` already demonstrates this pattern with `.join()` chains.
- The frontend is a single-page app with client-side routing (no Next.js pages). All auth gating must happen in React state, not at the Next.js route level.
- No existing React context provider pattern in the app -- this will be the first one.
- JWT tokens expire after 30 minutes (configurable via `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` env var). The frontend should handle token expiration gracefully (redirect to login).

## Recommendation

**Implementation order:**

1. **Backend first (Unit A)**: Add RBAC guards to the 6 unprotected routers. Follow the established pattern from `projects.py`: import `require_role`, `Role`, `User`; add `current_user: User = Depends(require_role([...]))` to each endpoint; where ownership filtering is needed use `apply_ownership_filter()` on queries and `require_ownership()` on single-resource fetches. Add `GET /users/me` to `routers/auth.py` so the frontend can hydrate user info.

2. **Frontend auth foundation (Unit B)**: Create `AuthProvider` context that wraps the app, manages `user`/`role`/`token` state, provides `login()` and `logout()` methods. Create `LoginPage` component. Modify `page.tsx` to show login when unauthenticated and app content when authenticated.

3. **Frontend sidebar and routing (Unit C)**: In `AppSidebar`, filter `mainNavItems` based on `userRole`. In `AppContent`, block access to unauthorized views (show 403 or redirect). Add sidebar item labels always visible but perhaps disabled for unauthorized roles.

4. **Frontend per-component gating (Unit D)**: Add conditional rendering in individual components: hide action buttons (create, edit, delete) based on `getWritableModels()` equivalent logic on the frontend.

## Verification

```bash
# Backend RBAC tests (existing)
cd backend && python -m pytest tests/test_rbac_integration.py -v

# Backend: verify unprotected routers now reject unauthenticated requests
curl -s http://localhost:8000/api/purchase-orders/ | grep -q "detail" && echo "AUTH OK"

# Backend: verify role enforcement
OWNER_TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
MANAGER_TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"username":"manager1_user","password":"test"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Owner sees all projects
curl -s http://localhost:8000/api/projects/ -H "Authorization: Bearer $OWNER_TOKEN" | python -c "import sys,json; data=json.load(sys.stdin); print(f'Owner sees {len(data)} projects')"

# Manager sees only own projects
curl -s http://localhost:8000/api/projects/ -H "Authorization: Bearer $MANAGER_TOKEN" | python -c "import sys,json; data=json.load(sys.stdin); print(f'Manager sees {len(data)} projects')"

# Frontend: verify login page renders, auth flow works, sidebar filters by role
# Frontend: verify warehouse role cannot access /api/projects/ (403)
```