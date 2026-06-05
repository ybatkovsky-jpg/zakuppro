# S03: Role-Based Access in Web UI

**Goal:** After this: Владелец видит все проекты и склад, Менеджер — только свои проекты, Склад — только остатки
**Demo:** Владелец видит все проекты и склад, Менеджер — только свои проекты, Склад — только остатки

## Must-Haves

- Все 6 ранее незащищённых роутеров (purchase_orders, invoices, payments, project_items, production_tasks, unresolved_transactions) отклоняют неаутентифицированные запросы (401)
- Owner видит все ресурсы; Manager видит только свои (через цепочки владения); Warehouse видит только stock-items (403 на всё остальное)
- Фронтенд показывает страницу логина при отсутствии токена
- Sidebar фильтрует пункты навигации по роли (Warehouse: только Dashboard + Склад)
- Кнопки действий (создать/редактировать/удалить) скрыты для неавторизованных ролей
- GET /users/me возвращает текущего пользователя с ролью
- Существующие RBAC-тесты продолжают проходить; новые тесты покрывают все защищённые роутеры

## Proof Level

- This slice proves: integration

## Integration Closure

Upstream surfaces consumed: backend/rbac.py (require_role, require_ownership, apply_ownership_filter), backend/auth.py (get_current_user, create_access_token), src/lib/auth.ts (login, logout, getUserRole), src/lib/api-client.ts (apiFetch with JWT)

New wiring introduced: AuthProvider React context wraps app in layout.tsx; page.tsx gates on isAuthenticated; sidebar and page components consume useAuth() hook; backend routers consume require_role + apply_ownership_filter dependencies

What remains before milestone is truly usable end-to-end: M007 S04 (DLQ Admin UI) для owner-only страницы администрирования

## Verification

- Backend: 401/403 responses include structured error_code (PERMISSION_DENIED), user_role, and required_permission — future agent can diagnose auth failures from response body alone. Ownership filtering failures surface as empty result sets (list) or 403 (single resource).
- Frontend: AuthProvider exposes isAuthenticated and role reactively via useAuth() hook. Login failures surface user-visible error messages. Token expiration triggers redirect to login page. localStorage keys (auth_token, user_role, username) provide inspectable auth state via browser DevTools.

## Tasks

- [x] **T01: Add RBAC guards to 6 unprotected routers + GET /users/me + integration tests** `est:2h`
  Why: 6 backend routers (purchase_orders, invoices, payments, project_items, production_tasks, unresolved_transactions) currently accept any request without authentication — all data is exposed. The RBAC framework (require_role, require_ownership, apply_ownership_filter) is already built and proven on projects, suppliers, stock_items, and analytics routers. This task applies the same patterns to close the security gap. Also adds GET /users/me so the frontend can hydrate user info on app load.
  - Files: `backend/routers/purchase_orders.py`, `backend/routers/invoices.py`, `backend/routers/payments.py`, `backend/routers/project_items.py`, `backend/routers/production_tasks.py`, `backend/routers/unresolved_transactions.py`, `backend/routers/auth.py`, `backend/tests/test_rbac_integration.py`
  - Verify: cd backend && python -m pytest tests/test_rbac_integration.py -v

- [x] **T02: Create AuthProvider context + LoginPage + wire into app shell** `est:1.5h`
  Why: Frontend has no reactive auth state — components must call getUserRole() directly from localStorage, which is brittle and non-reactive. No login UI exists. Before any role-based UI work can happen, the app needs a React context that provides user, role, token, login(), and logout() reactively, plus a login page that gates the entire app.
  - Files: `src/components/providers/auth-provider.tsx`, `src/components/app/login-page.tsx`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/lib/auth.ts`
  - Verify: cd src && npx tsc --noEmit --pretty 2>&1 | head -20

- [x] **T03: Filter sidebar navigation and guard views by user role** `est:1h`
  Why: Currently all 9 navigation items are visible to every user regardless of role. A warehouse user sees "Проекты", "Счета", "Аналитика" etc. — all links that lead to 403 errors or empty pages. The sidebar must filter items based on role, and the view router must block unauthorized view types.
  - Files: `src/components/app/app-sidebar.tsx`, `src/app/page.tsx`
  - Verify: cd src && npx tsc --noEmit --pretty 2>&1 | head -20

- [x] **T04: Add per-component role-based visibility gating for action buttons and sections** `est:1.5h`
  Why: Even with sidebar filtering, warehouse users who access the warehouse page still see "Создать", "Редактировать", "Удалить" buttons that lead to 403 errors. Similarly, manager users see owner-only actions. Each page component needs conditional rendering based on user role to hide UI elements the user cannot use.
  - Files: `src/components/app/warehouse.tsx`, `src/components/app/projects.tsx`, `src/components/app/dashboard.tsx`, `src/components/app/invoices.tsx`, `src/components/app/analytics.tsx`, `src/components/app/suppliers.tsx`
  - Verify: cd src && npx tsc --noEmit --pretty 2>&1 | head -20

## Files Likely Touched

- backend/routers/purchase_orders.py
- backend/routers/invoices.py
- backend/routers/payments.py
- backend/routers/project_items.py
- backend/routers/production_tasks.py
- backend/routers/unresolved_transactions.py
- backend/routers/auth.py
- backend/tests/test_rbac_integration.py
- src/components/providers/auth-provider.tsx
- src/components/app/login-page.tsx
- src/app/page.tsx
- src/app/layout.tsx
- src/lib/auth.ts
- src/components/app/app-sidebar.tsx
- src/components/app/warehouse.tsx
- src/components/app/projects.tsx
- src/components/app/dashboard.tsx
- src/components/app/invoices.tsx
- src/components/app/analytics.tsx
- src/components/app/suppliers.tsx
