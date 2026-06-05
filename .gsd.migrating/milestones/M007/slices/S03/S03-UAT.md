# S03: Role-Based Access in Web UI — UAT

**Milestone:** M007
**Written:** 2026-06-05T04:58:14.267Z

# UAT: Role-Based Access Control in Web UI

## UAT Type: Role-Based Access Control Verification

## Preconditions
- Backend running with seeded test data (owner user "owner" / role=owner, manager user "manager1" / role=manager with project1 ownership, manager user "manager2" / role=manager with no project ownership, warehouse user "warehouse" / role=warehouse)
- Frontend running at http://localhost:3000
- Database seeded with projects, purchase orders, invoices, payments, project items, production tasks, unresolved transactions across multiple owners

## Test Cases

### TC1: Unauthenticated User Sees Login Page
1. Open http://localhost:3000 in an incognito/clean browser window
2. **Expected**: LoginPage renders with centered card, username/password fields, and login button. No app sidebar, no nav items visible.

### TC2: Owner Login and Full Access
1. Login as "owner" / password
2. **Expected**: Redirected to Dashboard with full sidebar: Дашборд, Проекты, Поставщики, Запросы, Счета, Склад, Аналитика, Автоматизация, Настройки
3. Navigate to "Проекты" — see all projects from all managers. "Новый проект" button visible. "Загрузить Excel" button visible.
4. Navigate to "Счета" — see all invoices. Create/edit/delete operations available.
5. Navigate to "Аналитика" — see analytics data.
6. Navigate to "Поставщики" — "Добавить поставщика" button visible. Edit/delete on supplier cards available.
7. Navigate to "Настройки" — settings page renders (owner-only).

### TC3: Manager Login and Restricted Access
1. Login as "manager1" / password
2. **Expected**: Sidebar shows 8 main nav items (no Настройки). Settings section absent.
3. Navigate to "Проекты" — see only projects where owner_id = manager1's user ID. "Новый проект" button visible.
4. Navigate to "Счета" — see only invoices linked to own projects. Create/edit/delete available for own invoices.
5. Navigate to "Аналитика" — see analytics filtered to own projects.
6. Navigate to "Поставщики" — see suppliers list, but "Добавить поставщика" button **not visible** (owner-only).
7. Attempt to navigate to /settings via URL manipulation → **Expected**: Redirects to dashboard. Settings page not rendered.

### TC4: Warehouse Login and Minimal Access
1. Login as "warehouse" / password
2. **Expected**: Sidebar shows only 2 items: "Дашборд" and "Склад". All other nav items hidden.
3. Navigate to "Склад" — see stock items. "Создать", "Редактировать", "Удалить" buttons should be visible/hidden per warehouse write permissions.
4. Attempt to navigate to "Проекты", "Поставщики", "Запросы", "Аналитика", "Автоматизация" via URL manipulation → **Expected**: Each redirects to dashboard.
5. Navigate to "Счета" via URL → **Expected**: Access-denied EmptyState with message "Доступ закрыт. Для просмотра счетов обратитесь к руководителю".
6. Navigate to "Аналитика" via URL → **Expected**: Access-denied EmptyState with message "Доступ закрыт. Для просмотра аналитики обратитесь к руководителю".
7. Quick Actions on Dashboard: "Новый проект" and "Создать запрос" should be **hidden**. "Записать на склад" should be **visible**.

### TC5: Token Expiration / Auto-Logout
1. Login as any user
2. Manually clear the auth_token from localStorage in DevTools
3. Navigate to any view or trigger an API call
4. **Expected**: Redirected to LoginPage. Sidebar and app content no longer visible.

### TC6: Direct API Access Without Token
1. Send GET /api/invoices/ without Authorization header
2. **Expected**: HTTP 401. JSON body `{"detail": "Not authenticated"}`.

### TC7: Warehouse API Access
1. Login as warehouse user, extract JWT token
2. Send GET /api/invoices/ with the warehouse JWT
3. **Expected**: HTTP 403. JSON body includes `{"error_code": "PERMISSION_DENIED", "user_role": "warehouse", "required_permission": "owner or manager"}`.

### TC8: Manager Cross-Project Isolation
1. Login as "manager2" (has no projects of their own)
2. Navigate to "Проекты" → **Expected**: Empty state (no projects visible from manager1).
3. Send POST /api/purchase_orders/ with project_id belonging to manager1's project
4. **Expected**: HTTP 403 with PERMISSION_DENIED error.

## Edge Cases
- Session restoration on browser refresh: after login, refreshing the page should restore the session and show the app (not flash the login page)
- Loading state: on initial load with stored token, the app should show nothing (null) while verifying the token via GET /users/me, then show either the app or login page
- Graceful /users/me failure: if GET /users/me fails but a valid token exists, the app should fall back to localStorage role/username and remain functional
- Empty result sets: manager with no owned resources should see empty lists (not errors) when navigating to Projects, Invoices, etc.

## Not Proven By This UAT
- Backend integration test coverage (125 tests verified in CI session)
- Performance under load with many concurrent RBAC checks
- JWT token tampering resistance (tested at integration test level)
- Cross-service RBAC propagation (Celery tasks, Telegram bot — these use different auth mechanisms)
