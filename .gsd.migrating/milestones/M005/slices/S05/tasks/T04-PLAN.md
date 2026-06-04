---
estimated_steps: 19
estimated_files: 2
skills_used: []
---

# T04: Database Migration on Backend Startup

Ensure Alembic migrations run automatically when the backend container starts.

**Why:** Current setup requires manual `alembic upgrade head`. Production containers should auto-migrate on startup.

**Do:**
1. Create entrypoint.sh script in backend directory:
   - Run alembic upgrade head
   - Execute the CMD passed as arguments (uvicorn)
2. Make entrypoint.sh executable in Dockerfile:
   - Add COPY entrypoint.sh . after copying app code
   - Change USER to root before COPY, chmod +x entrypoint.sh, then back to appuser
3. Update backend Dockerfile CMD to use entrypoint:
   - Keep existing CMD but make it pass through entrypoint

**Alternative (simpler):**
- Update backend CMD in Dockerfile to run: sh -c 'alembic upgrade head && uvicorn backend.main:app --host 0.0.0.0 --port 8000'
- This avoids separate entrypoint script file

**Constraints:**
- alembic must be available in PATH (installed in requirements.txt)
- Migrations should run before uvicorn starts
- Failure to migrate should stop container startup (fail-fast)

**Done when:** Backend Dockerfile runs migrations on startup and `docker-compose up api` shows migration output before uvicorn starts

## Inputs

- `backend/Dockerfile`
- `backend/alembic.ini`

## Expected Output

- `backend/Dockerfile`
- `backend/entrypoint.sh`

## Verification

grep -q 'alembic upgrade head' backend/Dockerfile && grep -q 'uvicorn' backend/Dockerfile

## Observability Impact

Migration status visible in container logs. Startup failure exposes DB connection or migration issues.
