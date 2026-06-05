---
estimated_steps: 3
estimated_files: 3
skills_used: []
---

# T04: Wire failed-tasks view into app navigation (store, sidebar, page)

Why: The component alone is invisible. It needs route entries in the Zustand store, sidebar navigation, and page rendering logic to become reachable from the app shell.

Do: 1) Add 'failed-tasks' to ViewType union in src/store/app-store.ts. 2) In app-sidebar.tsx, add a new SidebarGroup labeled "Администрирование" below the settings separator, containing a single nav item: { label: 'Неудачные задачи', icon: AlertTriangle, view: 'failed-tasks' as ViewType }. Conditionally render the entire admin SidebarGroup only when role === 'owner'. 3) In src/app/page.tsx: add 'failed-tasks': 'Неудачные задачи' to pageTitles; add 'failed-tasks' to the owner array in roleViewAccess; import FailedTasks component; add render block for isViewAuthorized && currentView === 'failed-tasks'.

Done when: npx tsc --noEmit passes. Manual verification: sidebar shows "Администрирование" section with "Неудачные задачи" entry for owner; clicking navigates to the view; manager/warehouse users see neither the sidebar entry nor can access the view.

## Inputs

- `src/store/app-store.ts`
- `src/components/app/app-sidebar.tsx`
- `src/app/page.tsx`
- `src/components/providers/auth-provider.tsx`

## Expected Output

- `src/store/app-store.ts`
- `src/components/app/app-sidebar.tsx`
- `src/app/page.tsx`

## Verification

npx tsc --noEmit
