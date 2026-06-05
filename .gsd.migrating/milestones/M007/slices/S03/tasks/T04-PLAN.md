---
estimated_steps: 18
estimated_files: 6
skills_used: []
---

# T04: Add per-component role-based visibility gating for action buttons and sections

Why: Even with sidebar filtering, warehouse users who access the warehouse page still see "Создать", "Редактировать", "Удалить" buttons that lead to 403 errors. Similarly, manager users see owner-only actions. Each page component needs conditional rendering based on user role to hide UI elements the user cannot use.

Do:
1. In each component, import useAuth and check role before rendering action buttons:
   - warehouse.tsx: Hide "Создать" / "Редактировать" / "Удалить" buttons for warehouse role (warehouse can only view + receive stock)
   - projects.tsx: Hide "Создать проект" button for warehouse role; manager/owner keep it
   - dashboard.tsx: Hide "Склад" summary section for non-warehouse roles (or show for all — TBD); hide analytics widgets for warehouse role
   - invoices.tsx: Hide entire page content for warehouse role (show "Access Denied" or empty state); manager sees only own invoices (API-enforced) but keep create/edit
   - analytics.tsx: Hide for warehouse role (show "Access Denied"); manager sees own filtered data (API-enforced)
   - suppliers.tsx: Hide "Создать" / "Редактировать" / "Удалить" buttons for manager role (read-only); owner keeps all
2. Pattern: use a helper or inline check:
   ```tsx
   const { role } = useAuth();
   const canWrite = role === 'owner' || (role === 'manager' && !isOwnerOnlyResource);
   {canWrite && <CreateButton />}
   ```
3. For pages entirely inaccessible to a role (invoices for warehouse, analytics for warehouse): render an EmptyState or redirect, don't just hide buttons
4. Ensure TypeScript compiles cleanly with new role checks

Done when: Warehouse user sees no create/edit/delete buttons on warehouse page. Manager sees no create/edit/delete on suppliers page. Warehouse user accessing invoices or analytics sees an appropriate "access denied" message. All existing functionality for owner role is preserved.

## Inputs

- `src/components/providers/auth-provider.tsx`
- `src/components/app/warehouse.tsx`
- `src/components/app/projects.tsx`
- `src/components/app/dashboard.tsx`
- `src/components/app/invoices.tsx`
- `src/components/app/analytics.tsx`
- `src/components/app/suppliers.tsx`
- `src/types/fastapi.ts`

## Expected Output

- `src/components/app/warehouse.tsx`
- `src/components/app/projects.tsx`
- `src/components/app/dashboard.tsx`
- `src/components/app/invoices.tsx`
- `src/components/app/analytics.tsx`
- `src/components/app/suppliers.tsx`

## Verification

cd src && npx tsc --noEmit --pretty 2>&1 | head -20
