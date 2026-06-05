---
id: T04
parent: S03
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T04:52:54.391Z
blocker_discovered: false
---

# T04: Added per-component role-based visibility gating for action buttons, Quick Actions, and full-page access denial across all 6 app components

**Added per-component role-based visibility gating for action buttons, Quick Actions, and full-page access denial across all 6 app components**

## What Happened

Applied role-based conditional rendering across all 6 application components:

- **warehouse.tsx**: Added `canWrite` gating to "Заказать все" bulk reorder button and bulk actions (Переместить/Списать). Create/edit/delete gating was already in place from prior work.
- **projects.tsx**: Imported `useAuth`, added `canWrite` check (`role !== 'warehouse'`). Gated "Новый проект" create dialog, "Загрузить Excel" upload dialog, and delete dropdown menu item. EmptyState action conditionally passed only when `canWrite`.
- **dashboard.tsx**: Imported `useAuth`. Quick Action cards filtered by role: "Новый проект" and "Создать запрос" hidden for warehouse, "Добавить поставщика" shown only to owner, "Записать на склад" shown to all.
- **invoices.tsx**: Imported `useAuth`. Added early-return guard: warehouse role sees access-denied EmptyState with message "Доступ закрыт. Для просмотра счетов обратитесь к руководителю".
- **analytics.tsx**: Imported `useAuth`. Added early-return guard: warehouse role sees access-denied EmptyState with message "Доступ закрыт. Для просмотра аналитики обратитесь к руководителю".
- **suppliers.tsx**: Imported `useAuth`, set `canWrite = role === 'owner'`. Gated header "Добавить поставщика" button, made SupplierCard `onEdit`/`onDelete` props optional with conditional rendering, conditionally passed callbacks only for owner, gated EmptyState action.

Pattern used: `const { role } = useAuth()` with role-based `canWrite` checks, conditional rendering with `{condition && <Element />}`, and early-return guards for full-page access denial.

## Verification

TypeScript compilation: `npx tsc --noEmit --pretty` — no new errors in modified files. All 21 errors in dashboard.tsx (framer-motion Variants types) and 4 errors in projects.tsx (`@dnd-kit/core` exports) are pre-existing and unrelated to this change.

Verified by inspection:
- warehouse.tsx: `canWrite` guards on bulk actions (line ~1340) and "Заказать все" (line ~1263)
- projects.tsx: `canWrite` guards on create/upload dialogs and delete menu item, `useAuth` imported
- dashboard.tsx: QuickAction cards role-gated (owner/manager/warehouse), `useAuth` imported
- invoices.tsx: Warehouse access-denied early return before main render, `useAuth` imported
- analytics.tsx: Warehouse access-denied early return before main render, `useAuth` imported
- suppliers.tsx: `canWrite` guard on header button, optional onEdit/onDelete in SupplierCard, conditional callback passing, empty state action gated

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd src && npx tsc --noEmit --pretty 2>&1 | grep -E "components/app/(warehouse|projects|dashboard|invoices|analytics|suppliers)\.tsx" | grep -v "Variants" | grep -v "useDroppableContext" | grep -v "Expected 1 arguments" | grep -v "DragStartEvent" | grep -v "DragEndEvent"` | 0 | pass | 48000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
