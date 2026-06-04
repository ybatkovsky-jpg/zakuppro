# S02: Kanban Guardrails — UAT

**Milestone:** M006
**Written:** 2026-06-04T10:14:16.275Z

## UAT: Kanban Transition Guard

**UAT Type:** Integration / API

**Preconditions:**
- Backend API running on `http://localhost:8000`
- Database has test data: at least one project with ProjectItems in various statuses
- Authenticated as Owner user (valid JWT token)

**Steps:**

1. **Blocked: item at К закупке**
   - Create a project with one ProjectItem status="К закупке"
   - PUT /api/projects/{id} with body `{"status": "В производстве"}`
   - **Expected:** 422 response, detail contains "К закупке" and ready count "Готово: 0/1"

2. **Blocked: multiple non-ready statuses**
   - Add items with statuses "Запрошено" and "Счет получен" to the same project
   - PUT transition to "В производстве" again
   - **Expected:** 422 response, detail lists both "К закупке" and "Запрошено" with counts

3. **Allowed: all items На складе**
   - Change all items to status "На складе"
   - PUT transition to "В производстве"
   - **Expected:** 200 response, project.status = "В производстве", ProjectStatusHistory record exists with from_status→to_status

4. **Allowed: all items Оплачено**
   - Create another project with all items "Оплачено"
   - PUT transition to "В производстве"
   - **Expected:** 200 response, status changed, history recorded

5. **Allowed: non-production transition**
   - Create a project with items "К закупке"
   - PUT transition to "Проектирование" (non-production)
   - **Expected:** 200 response — guard does not block non-production status changes

**Edge Cases Verified:**
- Project with zero items → transition to production allowed (empty BOM is considered ready)
- Mixed "На складе" and "Оплачено" → transition allowed
- Items with empty/null status → treated as non-ready, blocked

**Not Proven By This UAT:**
- Frontend Kanban drag-and-drop behavior (requires running frontend at localhost:3000)
- S03 readiness matrix integration (separate slice)
- Stock write-off correctness on valid production transition (proven by S01 UAT)
