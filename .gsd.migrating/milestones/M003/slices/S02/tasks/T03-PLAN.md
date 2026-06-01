---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T03: Docker Service Configuration

Add email-worker service to docker-compose.yml with same base image as celery-worker. Mount volumes for code and /data/uploads. Configure IMAP environment variables (IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_USE_SSL, IMAP_FOLDER, POLL_INTERVAL). Add healthcheck and restart policy. Update .env with example IMAP configuration.

## Inputs

- `Existing docker-compose.yml structure`
- `Email worker entrypoint in Dockerfile`
- `IMAP configuration requirements`

## Expected Output

- `email-worker service definition in docker-compose.yml`
- `IMAP_* environment variables in .env`
- `Service starts and connects to IMAP successfully`

## Verification

docker-compose config | grep -A10 'email-worker:' && docker-compose up email-worker && docker inspect $(docker ps -q --filter 'name=email-worker') | grep -i 'healthcheck'
