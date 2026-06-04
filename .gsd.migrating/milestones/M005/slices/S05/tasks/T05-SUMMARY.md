---
id: T05
parent: S05
milestone: M005
key_files:
  - scripts/smoke-test.sh
key_decisions: []
duration: 
verification_result: mixed
completed_at: 2026-06-03T12:31:35.022Z
blocker_discovered: false
---

# T05: Created automated smoke test script validating core create-update-delete workflow

**Created automated smoke test script validating core create-update-delete workflow**

## What Happened

Created scripts/smoke-test.sh (216 lines, executable). The script tests the full CRUD workflow:

1. Login via POST /api/auth/login to get JWT token
2. Create project via POST /api/projects (validates 201 response, extracts project_id)
3. Retrieve project via GET /api/projects/{id} (verifies name matches)
4. Update project via PUT /api/projects/{id} (changes status to "completed")
5. Verify status change with GET
6. Delete project via DELETE /api/projects/{id} (validates 204 response)
7. Verify deletion with 404 on subsequent GET

Script features:
- Environment variable FASTAPI_URL for endpoint configuration
- Uses curl for HTTP requests and jq for JSON parsing
- Color-coded output (green for success, red for failure)
- Graceful error handling with clear messages
- Exit code 0 only if all steps pass
- Defaults: localhost:8000, admin/admin123 credentials

Note: Full verification requires docker-compose up -d with updated auth endpoints (currently running server predates auth router addition). Script syntax validated successfully.

## Verification

Script created at scripts/smoke-test.sh, executable (chmod +x), bash syntax validated. The script implements all 7 steps from the task plan: login, create, retrieve, update, verify update, delete, verify deletion. Uses FASTAPI_URL environment variable for endpoint configuration, defaults to localhost:8000. Exit code 0 on full success, 1 on any failure.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `{"command": "ls -la scripts/smoke-test.sh", "exitCode": 0, "verdict": "pass", "durationMs": 50}` | -1 | unknown (coerced from string) | 0ms |
| 2 | `{"command": "bash -n scripts/smoke-test.sh", "exitCode": 0, "verdict": "pass", "durationMs": 100}` | -1 | unknown (coerced from string) | 0ms |
| 3 | `{"command": "wc -l scripts/smoke-test.sh", "exitCode": 0, "verdict": "pass", "durationMs": 50}` | -1 | unknown (coerced from string) | 0ms |

## Deviations

Docker Desktop unavailable (500 Internal Server Error) prevented full end-to-end verification. Smoke test script is ready for execution once docker-compose up -d is run manually with updated backend.

## Known Issues

None.

## Files Created/Modified

- `scripts/smoke-test.sh`
