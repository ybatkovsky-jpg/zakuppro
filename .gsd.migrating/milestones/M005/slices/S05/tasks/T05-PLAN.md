---
estimated_steps: 22
estimated_files: 1
skills_used: []
---

# T05: Smoke Test Script

Create an automated smoke test script that validates the core create → update → delete workflow.

**Why:** Production readiness requires automated verification that the full stack works end-to-end.

**Do:**
1. Create scripts/smoke-test.sh:
   - Login to get JWT token (POST /api/auth/login with admin/admin123)
   - Create project via POST /api/projects with test data
   - Extract project_id from response
   - Update project status via POST /api/projects/{id}/status
   - Verify status change via GET /api/projects/{id}
   - Delete project via DELETE /api/projects/{id}
   - Verify deletion (404 on GET)
   - Return exit code 0 on success, 1 on failure
2. Use curl for all HTTP requests
3. Add jq for JSON parsing
4. Print progress messages for each step
5. Handle errors gracefully with clear messages

**Constraints:**
- Script should work against localhost:3000 (frontend proxy) or localhost:8000 (backend direct)
- Use FASTAPI_URL environment variable to determine endpoint
- Exit code 0 only if all steps pass
- Add shebang: #!/usr/bin/env bash

**Done when:** scripts/smoke-test.sh exists, is executable, and passes with `docker-compose up -d && bash scripts/smoke-test.sh`

## Inputs

- `backend/routers/auth.py`
- `backend/routers/projects.py`

## Expected Output

- `scripts/smoke-test.sh`

## Verification

bash scripts/smoke-test.sh && echo 'Exit code: $?'

## Observability Impact

Smoke test provides executable verification of core workflow. Failure points identify which service is broken.
