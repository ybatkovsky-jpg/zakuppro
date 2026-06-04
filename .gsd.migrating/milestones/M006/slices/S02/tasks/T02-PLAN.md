---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T02: Wire transition guard into project update router

Add can_transition_to check in update_project before allowing status change. Return HTTP 422 with descriptive reason when blocked. Ensure StatusHistory and write-off still fire on valid transitions.

## Inputs

- `backend/services/transition_service.py`
- `backend/routers/projects.py`

## Expected Output

- `backend/routers/projects.py`

## Verification

cd backend && python -c "from backend.routers.projects import update_project; print('update_project importable')"

## Observability Impact

HTTP 422 response with item-level breakdown when transition blocked
