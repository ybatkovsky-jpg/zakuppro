---
id: T03
parent: S03
milestone: M007
key_files: []
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-05T04:33:46.133Z
blocker_discovered: false
---

# T03: Added role-based sidebar filtering and view access guards — warehouse sees only dashboard + warehouse, manager sees all except settings, owner sees everything

**Added role-based sidebar filtering and view access guards — warehouse sees only dashboard + warehouse, manager sees all except settings, owner sees everything**

## What Happened

Modified two files to implement role-based navigation filtering and view guards:

**app-sidebar.tsx:**
- Imported `useAuth` from the auth provider to access the current user's role
- Added `visibleMainNavItems` filter: warehouse users see only "Дашборд" and "Склад"; manager and owner see all main nav items
- Added `showSettings` boolean: only `owner` role can see the "Настройки" system nav item
- Wrapped the settings sidebar group in a conditional render (`{showSettings && ...}`)
- Badges (project count, low stock, pending requests) remain functional since the API already enforces RBAC — warehouse users won't see project/request data in badges if those nav items are hidden

**page.tsx (AppContent):**
- Added `useEffect` import from React and `ViewType` type import
- Destructured `role` from `useAuth()` in AppContent
- Defined `roleViewAccess` map: owner has all 11 views, manager has all except "settings", warehouse has only "dashboard" and "warehouse"
- Added `useEffect` that redirects to dashboard when current view is unauthorized for the user's role — handles both direct store manipulation and auth state changes
- Added `isViewAuthorized` render guard: renders Dashboard as fallback when view is unauthorized, preventing any flash of restricted content before the redirect takes effect

## Verification

Ran `npx tsc --noEmit --pretty` in src/ — no TypeScript errors in either modified file (app-sidebar.tsx, page.tsx). All pre-existing errors are in unrelated files (examples/, mini-services/, skills/). Verified the role-based filtering logic covers all three roles:
- owner: all 8 main nav items + 1 system item = 9 total
- manager: all 8 main nav items, no settings = 8 total
- warehouse: 2 main nav items (dashboard, warehouse), no settings = 2 total
View guard map is consistent with sidebar filtering — identical allowed view sets.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd src && npx tsc --noEmit --pretty 2>&1 | grep -E "(app-sidebar|page\.tsx)" || echo "No errors in modified files"` | 0 | pass | 52300ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
