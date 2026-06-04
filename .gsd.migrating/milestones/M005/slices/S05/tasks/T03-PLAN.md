---
estimated_steps: 18
estimated_files: 1
skills_used: []
---

# T03: Missing Healthchecks for celery-worker and telegram-bot

Add healthchecks to celery-worker and telegram-bot services that currently lack them.

**Why:** Docker Compose cannot properly detect when these services are ready. Missing healthchecks mean dependent services may start too early.

**Do:**
1. **celery-worker healthcheck:**
   - Use celery inspect ping command (same as backend health endpoint)
   - test: ["CMD-SHELL", "celery -A backend.celery_app inspect ping --timeout=2 || exit 1"]
   - interval: 30s, timeout: 10s, retries: 3, start_period: 30s
2. **telegram-bot healthcheck:**
   - Use process check (ps aux grep pattern, similar to email-worker)
   - test: ["CMD-SHELL", "ps aux | grep telegram_bot | grep -v grep || exit 1"]
   - interval: 30s, timeout: 10s, retries: 3, start_period: 10s
3. Keep restart: unless-stopped for telegram-bot
4. Keep celery-worker without restart policy (handled by supervisor if needed)

**Constraints:**
- celery-worker must use the same celery CLI that's already in container
- telegram-bot process name must match the command pattern
- Healthcheck commands must return exit code 0 on success, 1 on failure

**Done when:** Both services have healthcheck section in docker-compose.yml and `docker-compose config` validates syntax

## Inputs

- `docker-compose.yml`

## Expected Output

- `docker-compose.yml`

## Verification

grep -A 5 'celery-worker:' docker-compose.yml | grep healthcheck && grep -A 5 'telegram-bot:' docker-compose.yml | grep healthcheck

## Observability Impact

Health status visible in docker-compose ps. Failed healthchecks expose worker/bot crashes.
