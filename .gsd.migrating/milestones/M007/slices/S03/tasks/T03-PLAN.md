---
estimated_steps: 21
estimated_files: 2
skills_used: []
---

# T03: Filter sidebar navigation and guard views by user role

Why: Currently all 9 navigation items are visible to every user regardless of role. A warehouse user sees "Проекты", "Счета", "Аналитика" etc. — all links that lead to 403 errors or empty pages. The sidebar must filter items based on role, and the view router must block unauthorized view types.

Do:
1. Modify src/components/app/app-sidebar.tsx:
   - Import useAuth from auth-provider
   - Define role-based nav item visibility:
     - Owner: all items visible
     - Manager: all items except "Настройки" (settings — limited access)
     - Warehouse: only "Дашборд" (dashboard) and "Склад" (warehouse)
   - Filter mainNavItems based on current user role before rendering
   - Apply same filtering to systemNavItems (warehouse and manager hide settings)
2. Modify src/app/page.tsx (AppContent section):
   - Import useAuth
   - Define a set of view types allowed per role:
     - warehouse: ['dashboard', 'warehouse']
     - manager: all except ['settings']
     - owner: all
   - Before rendering the currentView component, check if role allows it
   - If unauthorized: render an "Access Denied" message (or redirect to dashboard)
   - Edge case: if currentView is unauthorized on auth state change, redirect to dashboard
3. Ensure sidebar badges (project count, low stock) still work correctly with filtered data (API already enforces RBAC)

Done when: Warehouse user sees only "Дашборд" and "Склад" in sidebar. Manager sees all items except "Настройки". Owner sees everything. Navigating to an unauthorized view (e.g., by direct store manipulation) shows access denied or redirects.

## Inputs

- `src/components/providers/auth-provider.tsx`
- `src/components/app/app-sidebar.tsx`
- `src/app/page.tsx`
- `src/store/app-store.ts`
- `src/types/fastapi.ts`

## Expected Output

- `src/components/app/app-sidebar.tsx`
- `src/app/page.tsx`

## Verification

cd src && npx tsc --noEmit --pretty 2>&1 | head -20

## Observability Impact

Sidebar item visibility is deterministic based on role enum — mismatch between role and visible items is a configuration bug detectable by visual inspection. Unauthorized view access triggers redirect to dashboard (graceful degradation).
