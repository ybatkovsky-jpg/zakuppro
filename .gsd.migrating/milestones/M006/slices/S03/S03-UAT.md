# S03: Project Readiness Matrix — UAT

**Milestone:** M006
**Written:** 2026-06-04T10:54:24.999Z

## UAT: Project Readiness Matrix

### UAT Type
Visual + API Verification

### Preconditions
- Backend API running (`docker-compose up -d api` or direct `uvicorn`)
- Frontend running (`npm run dev` or Docker)
- Authenticated as **owner** or **manager** role
- At least 3 projects with varying procurement status:
  - **Project A**: All items `На складе` or `Оплачено` (fully ready)
  - **Project B**: Some items `Запрошено` or `Счет получен`, none `К закупке` (in transit)
  - **Project C**: At least one item `К закупке` (needs ordering)
  - **Project D**: Empty project (no items)

### Steps

1. **Navigate to Dashboard** (`/`) — observe the Recent Projects section
2. **Verify Project A** (fully ready): A **green dot** appears next to the status badge
3. **Verify Project C** (needs ordering): A **red dot** appears next to the status badge
4. **Verify Project B** (in transit): An **amber/yellow dot** appears next to the status badge
5. **Verify Project D** (empty): A **green dot** appears next to the status badge
6. **Click the green dot** on Project A: A **Popover tooltip** opens showing per-status breakdown (e.g., `На складе: 3, Оплачено: 2`)
7. **Click the red dot** on Project C: Popover shows breakdown including `К закупке: N`
8. **Navigate to Kanban view** — each `DraggableProjectCard` shows the same colored readiness dot
9. **Click any readiness dot in Kanban** — same Popover breakdown appears
10. **Log out** and directly request `GET /api/projects/readiness` — returns **401 Unauthorized**
11. **Log in as warehouse user** and request the endpoint — returns **403 Forbidden**

### Expected Outcomes
| Scenario | Readiness | Dot Color |
|----------|-----------|-----------|
| All items На складе/Оплачено | green | Green |
| Empty project (no items) | green | Green |
| Some Запрошено/Счет получен, no К закупке | yellow | Amber/Yellow |
| Any К закупке | red | Red |
| Unauthenticated request | — | 401 |
| Warehouse role request | — | 403 |

- Popover tooltip shows accurate per-status counts matching database
- Readiness fetch does not block page rendering — dots appear after data loads
- If readiness fetch fails, no dot is shown (no error state for supplementary data)

### Edge Cases Tested
- **Empty project**: Returns `green` with `ready_count=0, total_count=0`
- **Empty database** (no projects): Returns `200` with empty array `[]`
- **Single-item project**: Correctly classified (red if К закупке, green if На складе)
- **Manager ownership filter**: Manager only sees their own projects in the response
- **Mixed statuses**: Breakdown dict accurately counts each status

### Not Proven By This UAT
- Performance under load with 100+ projects (DB query uses single GROUP BY — expected to scale linearly with index)
- Readiness recalculation after status change (handled by S02 transition guard; readiness is always computed fresh on request)
- Visual rendering consistency across all supported browsers (component uses standard Tailwind CSS classes)

