---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T03: Add LLM provider configuration to .env and docker-compose.yml

Add LLM_PRIMARY_PROVIDER (openai/gemini/claude), LLM_SECONDARY_PROVIDER, and respective API keys to .env. Mount .env to celery-worker and telegram-bot services in docker-compose.yml.

## Inputs

- `Existing .env file`
- `docker-compose.yml`

## Expected Output

- `Updated .env with LLM provider config`
- `docker-compose.yml with env vars`
- `Documentation in .env.example`

## Verification

grep LLM_ .env && docker compose config | grep LLM_
