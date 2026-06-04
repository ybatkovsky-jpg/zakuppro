---
id: M006
title: "Business Logic Polish"
status: complete
completed_at: 2026-06-04T11:16:29.823Z
key_decisions:
  - D040: Partial reservation — reserve what's available, log warning, let S02 guard catch incomplete reserves
  - D041: Write-off scope — all reserved items regardless of ProjectItem.status on production start
  - D042: Unreserve on delete — release stock back to available in S01, full reserve lifecycle in one slice
  - Post-commit reservation pattern — fire reserve after db.commit() so ProjectItem rows exist for matching
  - Service-layer invariant enforcement (not DB triggers) — _validate_invariant() after every stock mutation
  - Shared PRODUCTION_READY_STATUSES constant — single source of truth for S02 guard and S03 readiness
  - GROUP BY aggregation for readiness — single DB round-trip vs per-project queries
key_files:
  - backend/services/stock_service.py
  - backend/services/transition_service.py
  - backend/models.py
  - backend/schemas.py
  - backend/routers/projects.py
  - backend/routers/project_items.py
  - backend/routers/stock_items.py
  - backend/tasks.py
  - backend/tests/test_stock_service.py
  - backend/tests/test_transition_service.py
  - backend/tests/test_readiness.py
  - src/types/fastapi.ts
  - src/lib/api/projects.ts
  - src/app/api/projects/readiness/route.ts
  - src/components/app/projects.tsx
  - src/components/app/dashboard.tsx
lessons_learned:
  - (none)
---

# M006: Business Logic Polish

**Automated warehouse operations and enforced business rules: auto-reserve stock on BOM creation, write-off on production start, release on delete, transition guard blocking premature production starts, and per-project readiness matrix with color indicators.**

## What Happened

M006 delivered three vertical slices that together automate and enforce the core business logic of the warehouse-to-production pipeline.

**S01 — Stock Reservation Engine (high risk, 5 tasks):** Created `backend/services/stock_service.py` with three primitives — `reserve_for_project`, `write_off_for_production`, `receive_stock` — all guarded by the inventory invariant `qty_total = qty_reserved + qty_available`. Added `ProjectStatusHistory` model, migration, and schemas for audit trail. Wired reservation into ProjectItem create/update endpoints and the Celery BOM task. Wired write-off and status history into project update router. Added `POST /api/stock-items/{id}/receive` endpoint with RBAC. Key decisions: post-commit reservation pattern, partial reservation with WARNING log, live reserved_count from DB, service-layer invariant enforcement. 36 tests pass.

**S02 — Kanban Guardrails (medium risk, 3 tasks):** Created `backend/services/transition_service.py` with `can_transition_to(project, target_status, db) → (bool, reason)` guard. Wired into `update_project` before side effects (history recording, stock write-off). Blocked transitions return HTTP 422 with item-level status breakdown. Non-production transitions pass through. Structured INFO logs on both blocked and allowed transitions. 16 tests pass covering blocking/allowing/edge cases. Advanced R012.

**S03 — Project Readiness Matrix (low risk, 3 tasks):** Created `GET /api/projects/readiness` endpoint computing green/yellow/red per project from ProjectItem.status counts via GROUP BY aggregation. Added TypeScript types, API method, and Next.js proxy route. Added colored readiness dots with click-to-expand Popover tooltips on both Kanban cards (projects.tsx) and Dashboard (dashboard.tsx). Fixed critical bug where readinessMap was not passed to KanbanColumn. 12 tests pass. Advanced and validated R014.

**Cross-slice integration:** PRODUCTION_READY_STATUSES constant shared between S02 (transition guard) and S03 (readiness endpoint). Consistent data model across all slices. 64 backend tests pass total (36+16+12), zero failures.

## Success Criteria Results

All 7 success criteria verified PASS:
1. Auto-reserve stock on BOM creation — S01 reserve_for_project in project_items.py + tasks.py, 36 tests
2. Write off reserved stock on production start — S01 write_off_for_production in update_project, round-trip tests
3. Release reservations on delete — S01 unreserve_for_project/unreserve_for_project_item in delete endpoints
4. Block premature production starts — S02 can_transition_to with HTTP 422, 16 tests
5. Surface per-project readiness — S03 GET /api/projects/readiness, Kanban + Dashboard dots, 12 tests
6. Inventory invariant — S01 _validate_invariant, 5+3 tests
7. Audit trail — S01 ProjectStatusHistory model, 3 tests

## Definition of Done Results

- All 3 slices complete with passing test suites (64 backend tests, 0 failures)
- All 11 tasks have SUMMARY.md artifacts
- Slice-level verification executed: backend tests, import checks, TypeScript compilation
- No regressions in pre-existing test suite
- Cross-slice integration verified: shared PRODUCTION_READY_STATUSES constant, consistent data model
- Requirements R012 advanced, R014 advanced and validated
- No known limitations, deviations, or outstanding follow-ups

## Requirement Outcomes

- R012 (Transition Guard): Advanced by S02. can_transition_to guard now enforces business rule blocking premature production starts. 16 tests verify.
- R014 (Readiness Matrix): Advanced and validated by S03. Full-stack readiness matrix: backend endpoint → Next.js proxy → React UI indicators. 12 tests + TypeScript verification.
- Stock reservation infrastructure (S01) underpins both requirements — not a standalone requirement but essential operational capability.

## Deviations

None.

## Follow-ups

None outstanding. All slices delivered complete with no known limitations.
