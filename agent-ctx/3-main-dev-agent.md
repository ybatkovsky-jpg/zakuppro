---
Task ID: 3
Agent: Main Dev Agent
Task: Budget tracking, activity feed, relative time utility, global search

Work Log:
1. Added `formatRelativeTime()` to `/src/lib/utils.ts` — Russian relative time formatting
2. Updated `/src/app/api/stats/route.ts` — added budgetData (totalBudget, spentBudget, pendingBudget, byCategory) and projectCostData (per-project budget/spent/status)
3. Created `/src/app/api/activity/route.ts` — unified activity feed from projects, status changes, purchase requests, invoices, warehouse transactions (limit 20)
4. Updated `/src/app/api/projects/route.ts` — added `?search=` query parameter filtering by name or customerName
5. Updated `/src/components/app/dashboard.tsx`:
   - Budget Overview section: SVG circular progress ring, total/spent/pending amounts, recharts horizontal bar chart by category
   - Project Costs table: per-project budget, spent with utilization bars (green <70%, amber 70-90%, red >90%)
   - Activity Feed: replaced Quick Actions card with scrollable feed using framer-motion staggered animations
   - Quick Actions moved to compact inline button bar at bottom
6. Created `/src/components/app/global-search.tsx` — Command dialog with Ctrl+K shortcut, searches projects/suppliers/warehouse via API
7. Updated `/src/app/page.tsx` — added GlobalSearch to top bar next to page title

All endpoints returning 200, no lint errors, dev server running clean.
