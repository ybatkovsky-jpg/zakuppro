---
estimated_steps: 12
estimated_files: 1
skills_used: []
---

# T01: Add telegram-bot service to docker-compose.yml

### Why
Telegram Bot needs to run as isolated Docker service per D002. Should depend on RabbitMQ healthcheck.

### Do
1. Add telegram-bot service to docker-compose.yml
2. Use existing backend/Dockerfile for build context
3. Command: python -m backend.telegram_bot
4. Environment: TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID, ALLOWED_CHAT_IDS, CELERY_BROKER_URL
5. Add depends_on with rabbitmq healthcheck condition
6. Set restart: unless-stopped

### Done when
- Service definition exists in docker-compose.yml
- Service builds and starts without errors

## Inputs

- `docker-compose.yml`
- `backend/Dockerfile`

## Expected Output

- `docker-compose.yml`

## Verification

grep -q telegram-bot docker-compose.yml

## Observability Impact

Service health logged to stdout
