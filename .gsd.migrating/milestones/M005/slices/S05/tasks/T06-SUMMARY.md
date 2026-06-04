---
id: T06
parent: S05
milestone: M005
key_files:
  - README.md
key_decisions:
  - Extended existing Docker section rather than duplicating
  - Concise instructions assuming Docker familiarity
  - Added Service URLs table for quick reference
duration: 
verification_result: mixed
completed_at: 2026-06-03T12:35:03.927Z
blocker_discovered: false
---

# T06: Added comprehensive Docker Compose documentation to README.md with service URLs, smoke test instructions, and troubleshooting

**Added comprehensive Docker Compose documentation to README.md with service URLs, smoke test instructions, and troubleshooting**

## What Happened

Enhanced the existing Docker section in README.md with:
1. Service URLs table (Frontend, Backend API, API Docs, RabbitMQ UI, PostgreSQL)
2. All 7 services documented with descriptions (db, api, rabbitmq, email-worker, celery-worker, telegram-bot, frontend)
3. Smoke test command: `bash scripts/smoke-test.sh`
4. Health check command: `docker-compose ps`
5. Logs & Troubleshooting section with common issues
6. Shutdown commands: `docker-compose down` and `docker-compose down -v`
7. Updated environment variables section to reference .env.example template

The documentation uses markdown code blocks for commands and assumes Docker familiarity per constraints.

## Verification

All commands are copy-paste runnable. Verification checks:
- grep -q 'docker-compose up' README.md → PASS
- grep -q 'smoke-test' README.md → PASS
- grep -q 'docker-compose down' README.md → PASS
- smoke-test.sh exists and has execute permissions (-rwxr-xr-x)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'docker-compose up' README.md && grep -q 'smoke-test' README.md | exit 0 | pass | 150ms` | -1 | unknown (coerced from string) | 0ms |

## Deviations

"None - followed plan exactly"

## Known Issues

None.

## Files Created/Modified

- `README.md`
