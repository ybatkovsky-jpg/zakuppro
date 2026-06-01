---
estimated_steps: 12
estimated_files: 1
skills_used: []
---

# T03: Enhance health check with database connectivity

## Why
Current /health endpoint only returns {"status": "ok"} without verifying database connection. This change adds real database connectivity check so health failures are visible immediately.

## Do
1. Modify `backend/routers/health.py`:
   - Add `db: Session = Depends(get_db)` parameter to health_check endpoint
   - Import `get_db` from backend.database
   - Execute `db.execute(text('SELECT 1'))` to verify connectivity
   - Return 200 with `{"status": "ok", "db_status": "ok"}` on success
   - Return 503 with `{"status": "degraded", "db_status": "error", "detail": str(e)}` on database error
2. Use SQLAlchemy 2.0 text() for raw query

## Done when
GET /health returns db_status field. Healthcheck fails when database is unreachable.

## Inputs

- `backend/routers/health.py`
- `backend/database.py`

## Expected Output

- `backend/routers/health.py`

## Verification

curl http://localhost:8000/health | grep -q db_status
