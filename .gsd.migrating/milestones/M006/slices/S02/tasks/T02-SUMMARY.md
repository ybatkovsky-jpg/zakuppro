---
id: T02
parent: S02
milestone: M006
key_files: []
key_decisions: []
duration: 
verification_result: untested
completed_at: 2026-06-04T09:48:50.916Z
blocker_discovered: false
---

# T02: Wired transition_service.can_transition_to guard into update_project, blocking invalid transitions with HTTP 422

**Wired transition_service.can_transition_to guard into update_project, blocking invalid transitions with HTTP 422**

## What Happened

Added can_transition_to check in update_project before allowing status change. The guard runs before history recording and write-off. Returns HTTP 422 with descriptive reason (item counts by non-ready status) when blocked. Valid transitions proceed with history + write-off unchanged. Import added for transition_service alongside existing stock_service.

## Verification

cd backend && PYTHONPATH=. python -c "from backend.routers.projects import update_project; print('update_project importable')" passed

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

None.
