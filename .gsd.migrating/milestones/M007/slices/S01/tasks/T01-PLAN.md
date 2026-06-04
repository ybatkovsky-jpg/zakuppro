---
estimated_steps: 11
estimated_files: 3
skills_used: []
---

# T01: Add heartbeat to email-worker + Docker infrastructure (volume, healthchecks, stop_grace_period)

Why: email-worker currently uses `ps aux | grep` for Docker healthcheck which is fragile. The FastAPI /health endpoint cannot check non-HTTP workers without a shared mechanism. Heartbeat files on a shared volume provide the lightest cross-container health signal.

Do:
1. In email_worker.py: After each successful poll iteration in poll_once(), write current UTC timestamp to /data/health/email_worker_heartbeat. Use `Path(/data/health).mkdir(parents=True, exist_ok=True)` on first write. Write atomic: write to temp file then os.replace().
2. In docker-compose.yml:
   - Add `healthcheck_data` named volume
   - Mount `healthcheck_data:/data/health` in api, email-worker, and telegram-bot services
   - Replace email-worker healthcheck: `ps aux | grep` → heartbeat freshness check: `test -f /data/health/email_worker_heartbeat && test $(($(date +%s) - $(stat -c %Y /data/health/email_worker_heartbeat))) -lt 120`
   - Replace telegram-bot healthcheck: `ps aux | grep` → heartbeat freshness check: `test -f /data/health/telegram_bot_heartbeat && test $(($(date +%s) - $(stat -c %Y /data/health/telegram_bot_heartbeat))) -lt 90`
   - Add stop_grace_period: 60s to celery-worker, 30s to email-worker, 15s to telegram-bot
3. In Dockerfile: Add `RUN mkdir -p /data/health && chown appuser:appuser /data/health` before the USER switch or after WORKDIR.

Done when: email_worker.py writes heartbeat each poll; docker-compose config validates; email-worker Docker healthcheck uses heartbeat freshness.

## Inputs

- `backend/email_worker.py`
- `docker-compose.yml`
- `backend/Dockerfile`

## Expected Output

- `backend/email_worker.py`
- `docker-compose.yml`
- `backend/Dockerfile`

## Verification

python -m pytest backend/tests/test_email_worker.py -v
