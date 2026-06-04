# M006: Business Logic Polish — Context

**Date:** 2026-06-04
**Status:** Ready for execution

## Scope

Automate warehouse operations and enforce business rules: auto-reserve stock on BOM creation, write off reserved stock on production start, release reservations when projects/items are deleted, block premature production starts, and surface per-project readiness with color indicators.

## Grey Areas Resolved

### 1. Partial vs full reservation (Decision D040)

**Question:** ProjectItem needs 10 units, only 3 are available on warehouse. Reserve 3 (partial) or fail entirely?

**Answer:** **Partial reservation.** Reserve what's available, log warning with project_id and SKU. Project proceeds with incomplete reserve. S02 Kanban guardrails will detect incomplete reservations and block transition to production.

### 2. Write-off scope (Decision D041)

**Question:** When project enters production, write off ALL reserved items or only those with ProjectItem.status = "На складе"/"Оплачено"?

**Answer:** **All reserved items**, regardless of ProjectItem status. Simpler invariant: if it's reserved, it goes when production starts. S02 guards ensure only ready projects transition.

### 3. Unreserve on delete (Decision D042)

**Question:** When a ProjectItem is deleted or a Project is deleted, should reserved stock be released back to available? In S01 or S02?

**Answer:** **In S01.** `stock_service.unreserve_for_project_item(item_id, db)` releases a single item's reservation. `stock_service.unreserve_for_project(project_id, db)` releases all reservations for a project. Wired into delete endpoints in project_items and projects routers. Full reserve lifecycle in one slice.

## Architecture Constraints

- Invariant `qty_total = qty_reserved + qty_available` enforced at service layer (per MEM105), NOT via DB triggers
- StockItem.project_items and ProjectItem.stock_item relationships already exist
- `telegram_notifier.py` already accepts `reserved_count` parameter — just needs a non-zero value passed from BOM task
- Project statuses: Проектирование → Закупки → В производстве → Монтаж (no "cancelled" status exists)

## Out of Scope for M006

- DB-level constraints for inventory invariant
- Race condition handling (SELECT FOR UPDATE) — deferred, low-probability in single-owner usage
- New project terminal statuses (e.g., "Отменен") — if needed, a separate milestone should add it
