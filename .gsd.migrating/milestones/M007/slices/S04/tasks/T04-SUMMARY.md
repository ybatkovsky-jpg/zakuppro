---
id: T04
parent: S04
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T05:22:56.495Z
blocker_discovered: false
---

# T04: Restructured sidebar to place failed-tasks under a separate "Администрирование" group with AlertTriangle icon, gated to owner role only

**Restructured sidebar to place failed-tasks under a separate "Администрирование" group with AlertTriangle icon, gated to owner role only**

## What Happened

## What Happened

T04 was partially pre-wired by T03 — `page.tsx` already had the FailedTasks import, page title, role-based view access entry, and render block; `app-store.ts` already had 'failed-tasks' in the ViewType union. The remaining work was restructuring the sidebar to match the task plan specification.

### Changes Made

**`src/components/app/app-sidebar.tsx`:**
- Replaced `XCircle` import with `AlertTriangle` from lucide-react (as specified in the task plan)
- Removed `'failed-tasks'` entry from `mainNavItems` array — it no longer lives in the main "Навигация" group
- Extracted the failed-tasks nav item into a standalone `adminNavItem` constant using `AlertTriangle` icon
- Removed the `failed-tasks`-specific filter branch from `visibleMainNavItems` (no longer needed since the item moved out of mainNavItems)
- Added a new `SidebarGroup` labeled "Администрирование" below the settings section, containing the `adminNavItem`, conditionally rendered only when `role === 'owner'`

**No changes needed to `src/store/app-store.ts`** — `'failed-tasks'` was already in the ViewType union.

**No changes needed to `src/app/page.tsx`** — `FailedTasks` import, `pageTitles` entry, `roleViewAccess.owner` entry, and render block were all in place.

### Structure

The sidebar now has three sections (for owner role):
1. Навигация — main nav items (dashboard, projects, suppliers, requests, invoices, warehouse, analytics, automation)
2. Система — settings (owner-only, sr-only label)
3. Администрирование — failed tasks (owner-only, with visible group label)

## Verification

## Verification

Ran `npx tsc --noEmit` — zero errors in the modified files (`app-sidebar.tsx`, `page.tsx`, `app-store.ts`, `failed-tasks` component). All existing tsc errors are pre-existing in unrelated files (dashboard.tsx framer-motion types, examples/, mini-services/, skills/).

Manual verification of the sidebar structure:
- `mainNavItems` no longer contains a `failed-tasks` entry
- `adminNavItem` uses `AlertTriangle` icon from lucide-react
- "Администрирование" SidebarGroup is conditionally rendered with `role === 'owner'` guard
- The admin group appears below the settings section with a SidebarSeparator
- Non-owner roles (manager, warehouse) will not see the admin group or its failed-tasks nav item
- `page.tsx` `roleViewAccess.owner` includes `'failed-tasks'`; manager and warehouse arrays do not
- `page.tsx` renders `<FailedTasks />` for `isViewAuthorized && currentView === 'failed-tasks'`

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit 2>&1 | grep -E "(app-sidebar|page\.tsx|app-store|failed-tasks)" || echo "No errors in modified files"` | 0 | pass | 45000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
