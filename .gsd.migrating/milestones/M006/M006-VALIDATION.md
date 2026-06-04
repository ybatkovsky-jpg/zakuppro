---
verdict: pass
remediation_round: 0
---

# Milestone Validation: M006

## Success Criteria Checklist
### M006 Success Criteria Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Auto-reserve stock on BOM creation | PASS | S01-T03: `stock_service.reserve_for_project()` called in `project_items.py` after create/update and in `tasks.py` after Step 5 of `process_bom_to_project`. 36 tests verify full/partial/no-match reservation. |
| 2 | Write off reserved stock on production start | PASS | S01-T04: `stock_service.write_off_for_production()` called in `update_project` on transition to "В производстве". Write-off tests confirm qty_total and qty_reserved decrease. |
| 3 | Release reservations on project/item delete | PASS | S01: `unreserve_for_project_item()` and `unreserve_for_project()` wired into delete endpoints per D042. Full reserve lifecycle in one slice. |
| 4 | Block premature production starts | PASS | S02: `can_transition_to()` guard blocks transition to "В производстве" when any ProjectItem is not "На складе"/"Оплачено". HTTP 422 with item-level status breakdown. 16 tests cover blocking/allowing/edge cases. |
| 5 | Surface per-project readiness with color indicators | PASS | S03: `GET /api/projects/readiness` returns green/yellow/red per project. Colored dots on Kanban cards and Dashboard with click-to-expand Popover tooltips. 12 backend tests + TypeScript compilation clean. |
| 6 | Inventory invariant qty_total = qty_reserved + qty_available | PASS | S01: `_validate_invariant()` called after every stock mutation. 5 dedicated tests + 3 round-trip tests verify invariant enforcement. |
| 7 | ProjectStatusHistory audit trail on status changes | PASS | S01-T01/T04: `ProjectStatusHistory` model with from_status/to_status/changed_by/changed_at. Record created on every status transition in `update_project`. 3 dedicated tests verify. |

## Slice Delivery Audit
### Slice Delivery Audit

#### S01 — Stock Reservation Engine (status: complete, risk: high)
- **Claimed:** stock_service.py with reserve/write-off/receive primitives, wired into ProjectItem CRUD, Celery BOM task, project update, + receive endpoint
- **Delivered:** All 5 tasks complete. `stock_service.py` (3 primitives + invariant guard), `ProjectStatusHistory` model + migration, `POST /api/stock-items/{id}/receive` endpoint with RBAC, reservation wiring in project_items.py and tasks.py, write-off + history in update_project. 36 tests pass (0 failures).
- **Verdict:** MATCH — claimed output delivered with verification evidence.

#### S02 — Kanban Guardrails (status: complete, risk: medium)
- **Claimed:** transition_service.py with can_transition_to guard, HTTP 422 rejection on blocked transitions, 16 tests
- **Delivered:** All 3 tasks complete. `can_transition_to(project, target_status, db) → (bool, reason)` with item-level breakdown. Wired into `update_project` before side effects. Structured INFO logs. 16 tests pass.
- **Verdict:** MATCH — claimed output delivered with verification evidence.

#### S03 — Project Readiness Matrix (status: complete, risk: low)
- **Claimed:** GET /api/projects/readiness endpoint, green/yellow/red indicators, Kanban + Dashboard UI
- **Delivered:** All 3 tasks complete. Backend endpoint with GROUP BY aggregation, RBAC, ownership filtering. TypeScript types + API method + Next.js proxy route. Colored dots with Popover tooltips on both Kanban (projects.tsx) and Dashboard (dashboard.tsx). 12 tests pass + TypeScript compilation clean.
- **Verdict:** MATCH — claimed output delivered with verification evidence.

## Cross-Slice Integration
### Cross-Slice Integration

**S01 → S02 (Stock → Guard):** Transition guard checks ProjectItem.status against PRODUCTION_READY_STATUSES (На складе, Оплачено). These statuses are set via procurement flow which S01's stock_service supports through reserve/write-off/receive operations. The guard prevents premature production start when items haven't been received/paid.

**S02 → S03 (Guard → Readiness):** `PRODUCTION_READY_STATUSES` constant exported from `transition_service.py` (S02) is imported by readiness endpoint (S03). Same constant shared across both modules — no duplication, single source of truth.

**S01 → S03 (Stock → Readiness):** Readiness endpoint computes green/yellow/red from `ProjectItem.status` counts. ProjectItem.status values are managed through the procurement pipeline that S01's stock_service integrates with (reserve → purchase → receive → ready). S03 therefore accurately reflects the stock state S01 manages.

**Integration gaps:** None. All 3 slices share consistent data model (ProjectItem.status, StockItem.qty fields), share the PRODUCTION_READY_STATUSES constant, and operate on the same DB tables without conflicts.

**Full test coverage:** 64 backend tests pass across all 3 slices (36 stock + 16 transition + 12 readiness). No regressions in pre-existing test suite.

## Requirement Coverage
### Requirement Coverage

**R012 — Transition Guard (advanced by S02):** `can_transition_to()` enforces the business rule: transition to "В производстве" is blocked when any ProjectItem is not "На складе" or "Оплачено". 16 tests verify blocking for К закупке, Запрошено, Счет получен, mixed statuses; allowing for all-ready, all-Оплачено, mixed ready, empty projects, non-production targets.

**R014 — Readiness Matrix (advanced & validated by S03):** `GET /api/projects/readiness` returns green/yellow/red per project. 12 tests cover all readiness levels, RBAC, ownership filtering, edge cases. Frontend renders colored dots with tooltip breakdowns on both Kanban and Dashboard. End-to-end path verified: DB → FastAPI → Next.js proxy → React components.

**Unmapped M006 scope items:**
- Stock reservation/write-off/receive (S01) — these are infrastructure capabilities underpinning R012 and R014, not standalone requirements. The invariant enforcement and receive endpoint are operational necessities.
- ProjectStatusHistory (S01) — audit trail capability, not a standalone requirement. Provides observability for status transitions.

**Gaps:** None. All M006 scope items map to requirements or are justified as infrastructure/observability.


## Verdict Rationale
All 5 scope items from M006-CONTEXT.md delivered with passing tests (64 backend tests, 0 failures). All 3 slices verified independently with their own test suites. Cross-slice integration confirmed via shared PRODUCTION_READY_STATUSES constant and consistent data model. Requirements R012 and R014 advanced/validated with evidence. No known limitations, deviations, or follow-ups outstanding. Verdict: PASS.
