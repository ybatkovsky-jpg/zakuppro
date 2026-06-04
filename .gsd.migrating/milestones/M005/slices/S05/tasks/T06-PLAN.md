---
estimated_steps: 18
estimated_files: 1
skills_used: []
---

# T06: README.md Documentation

Update README.md with Docker Compose startup instructions and smoke test documentation.

**Why:** Users need clear instructions for running the production stack.

**Do:**
1. Add Docker Compose section to README.md:
   - Prerequisites (Docker, Docker Compose)
   - Quick start: docker-compose up -d
   - Service URLs (frontend: http://localhost:3000, backend: http://localhost:8000, RabbitMQ UI: http://localhost:15672)
   - Health check command: docker-compose ps
   - Smoke test command: bash scripts/smoke-test.sh
2. Document all 7 services with descriptions
3. Add troubleshooting section for common issues
4. Document required environment variables (see .env.example)
5. Add shutdown command: docker-compose down

**Constraints:**
- Use markdown code blocks for commands
- Keep instructions concise (assume Docker familiarity)
- Reference existing README sections don't duplicate

**Done when:** README.md has Docker section and all commands are copy-paste runnable

## Inputs

- `README.md`
- `docker-compose.yml`

## Expected Output

- `README.md`

## Verification

grep -q 'docker-compose up' README.md && grep -q 'smoke-test' README.md

## Observability Impact

Documentation enables users to self-diagnose issues. Clear commands reduce support burden.
