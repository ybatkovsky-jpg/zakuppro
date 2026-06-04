---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: Build transition_service.py with can_transition_to guard

Create backend/services/transition_service.py with can_transition_to(project, target_status, db) returning (bool, reason). For В производстве target, verifies every ProjectItem is На складе or Оплачено. Returns blocking reason with item counts when not ready.

## Inputs

- `backend/models.py`
- `backend/services/stock_service.py`

## Expected Output

- `backend/services/transition_service.py`

## Verification

cd backend && python -c "from backend.services.transition_service import can_transition_to; print('transition_service importable')"

## Observability Impact

structured INFO logs on blocked transitions with project ID, item counts, and blocking reason
