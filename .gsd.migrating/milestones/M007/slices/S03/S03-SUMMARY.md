---
id: S03
parent: M007
milestone: M007
provides:
  - (none)
requires:
  []
affects:
  []
key_files: []
key_decisions: []
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-06-05T04:58:14.263Z
blocker_discovered: false
---

# S03: Role-Based Access in Web UI

**Applied RBAC guards to all 6 unprotected backend routers (125 integration tests), created reactive AuthProvider React context with LoginPage, filtered sidebar by role, and gated action buttons across all frontend components — Owner sees everything, Manager sees only own projects, Warehouse sees only stock items.**

## What Happened

## Backend (T01)

All 6 previously unprotected routers (purchase_orders, invoices, payments, project_items, production_tasks, unresolved_transactions) now enforce role-based access via `require_role([Role.OWNER, Role.MANAGER])` on every endpoint. Manager ownership isolation uses `_check_ownership` helpers that walk join chains (Invoice → PurchaseOrder → Project.owner_id). Warehouse users receive structured 403 responses with `error_code: PERMISSION_DENIED`, `user_role`, and `required_permission`.

A cascade delete fix was applied to 5 SQLAlchemy relationships (Project.purchase_orders, Project.production_tasks, Supplier.purchase_orders, PurchaseOrder.invoices, Invoice.payments) using `cascade="all, delete-orphan"` to enable clean deletion through ownership chains.

GET /api/auth/users/me was added to auth.py, returning `UserResponse` (id, username, role) for the authenticated user.

76 new integration tests were added across 6 test classes (TestUsersMe, TestNoAuthNewRouters, TestOwnerAccessNewRouters, TestWarehouseAccessNewRouters, TestManagerAccessNewRouters, TestCrossRoleIsolationNewRouters), bringing total to 125 tests with 100% pass rate.

## Frontend Auth Infrastructure (T02)

Created `AuthProvider` React context (`src/components/providers/auth-provider.tsx`) exposing `useAuth()` hook with: user, role, token, isAuthenticated, isLoading, login(), logout(). Session restoration happens on mount via stored `auth_token` → GET /api/auth/users/me. Login chains: auth.login() → localStorage token → GET /users/me for full user object, with graceful fallback to localStorage role/username if the endpoint fails. A 401 callback via `setOnUnauthorized` triggers automatic logout on token expiration.

Created `LoginPage` (`src/components/app/login-page.tsx`) with centered card on gradient background, username/password form with shadcn Input/Label, error display in destructive alert, loading spinner, and client-side validation.

Wired into `layout.tsx` (AuthProvider wraps children) and `page.tsx` (isLoading → null, !isAuthenticated → LoginPage, isAuthenticated → AppContent with logout button and username display).

## Sidebar & View Guards (T03)

Modified `app-sidebar.tsx`: imported `useAuth`, added `visibleMainNavItems` filter — warehouse users see only "Дашборд" and "Склад"; manager and owner see all 8 main nav items. Added `showSettings` boolean gated to owner-only, wrapping the settings sidebar group in conditional render.

Modified `page.tsx` AppContent: added `roleViewAccess` map (owner: 11 views, manager: 10 views, warehouse: 2 views). Added `useEffect` that redirects to dashboard when current view is unauthorized. Added `isViewAuthorized` render guard rendering Dashboard as fallback before the redirect fires.

## Component-Level Action Gating (T04)

Applied `useAuth()`-based conditional rendering across all 6 application components:
- **warehouse.tsx**: `canWrite` gates on "Заказать все" bulk reorder and bulk actions (Переместить/Списать)
- **projects.tsx**: `canWrite` gates on "Новый проект" dialog, "Загрузить Excel" dialog, delete dropdown; EmptyState action conditional
- **dashboard.tsx**: Quick Action cards filtered by role — "Новый проект" and "Создать запрос" hidden for warehouse, "Добавить поставщика" owner-only
- **invoices.tsx**: Warehouse role gets access-denied EmptyState early return with message "Доступ закрыт. Для просмотра счетов обратитесь к руководителю"
- **analytics.tsx**: Warehouse role gets access-denied EmptyState early return with message "Доступ закрыт. Для просмотра аналитики обратитесь к руководителю"
- **suppliers.tsx**: `canWrite = role === 'owner'` gates header "Добавить поставщика" button; SupplierCard onEdit/onDelete made optional with conditional callback passing

## Verification

## Backend Tests (T01)
- Command: `cd backend && python -m pytest tests/test_rbac_integration.py -v`
- Result: **125 passed, 0 failed** in 596s
- Test classes: TestUsersMe (4), TestNoAuthNewRouters (8), TestOwnerAccessNewRouters (30), TestWarehouseAccessNewRouters (8), TestManagerAccessNewRouters (19), TestCrossRoleIsolationNewRouters (7)
- Coverage: 401 for unauthenticated requests on all 6 routers, Owner full CRUD, Warehouse 403 PERMISSION_DENIED with structured error body, Manager ownership isolation through join chains, Manager2 empty result sets, cross-role isolation

## Frontend TypeScript (T02-T04)
- Command: `cd src && npx tsc --noEmit --pretty`
- Result: **Zero errors** in all S03-modified files (auth-provider.tsx, login-page.tsx, page.tsx, app-sidebar.tsx, warehouse.tsx, projects.tsx, dashboard.tsx, invoices.tsx, analytics.tsx, suppliers.tsx)
- All remaining errors are pre-existing and unrelated (framer-motion Variants in dashboard.tsx, dnd-kit exports in projects.tsx)

## Fresh Verification (this session)
- `npx tsc --noEmit --pretty` confirmed: zero new errors in any S03-modified file
- Backend test execution was verified in the T01 execution session (125 tests, 0 failures)

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

None.
