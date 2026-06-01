---
id: T05
parent: S02
milestone: M002
key_files:
  - backend/tasks.py
  - .env
  - docker-compose.yml
key_decisions: []
duration: 
verification_result: passed
completed_at: 2026-06-01T10:37:40.958Z
blocker_discovered: false
---

# T05: Added ALLOWED_CHAT_IDS to .env and configured /data/uploads volume mount in telegram-bot service

**Added ALLOWED_CHAT_IDS to .env and configured /data/uploads volume mount in telegram-bot service**

## What Happened

The queue_excel_processing Celery task was already implemented in T03. This task completed the remaining items:
1. Added ALLOWED_CHAT_IDS environment variable to .env with comma-separated example chat IDs
2. Added uploads_data volume and /data/uploads mount to telegram-bot service in docker-compose.yml
3. Verified task imports correctly and returns expected stub format

The npm run lint errors are pre-existing React frontend issues (setState in useMemo/useEffect in settings.tsx, theme-toggle.tsx, carousel.tsx, use-mobile.ts) unrelated to this backend task.

## Verification

Verified task imports successfully with `python -c "from backend.tasks import queue_excel_processing; print('task import OK')"`. Verified stub execution returns expected format with status, task_id, file_path, file_size, and chat_id fields. Verified .env contains ALLOWED_CHAT_IDS variable. Verified docker-compose.yml has uploads_data volume and /data/uploads mount for telegram-bot service.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `python -c "from backend.tasks import queue_excel_processing; print('task import OK')"` | 0 | pass | 500ms |
| 2 | `grep -E "ALLOWED_CHAT_IDS|TELEGRAM" .env` | 0 | pass | 100ms |
| 3 | `python stub task execution test` | 0 | pass | 300ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/tasks.py`
- `.env`
- `docker-compose.yml`
