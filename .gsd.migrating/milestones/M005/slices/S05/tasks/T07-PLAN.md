---
estimated_steps: 19
estimated_files: 4
skills_used: []
---

# T07: Full Docker Compose Verification

Verify the complete Docker Compose stack starts correctly and all services become healthy.

**Why:** Final verification that S05 goal is achieved: production-ready Docker Compose deployment.

**Do:**
1. Build all services: docker-compose build --no-cache
2. Start all services: docker-compose up -d
3. Wait for all services to become healthy: docker-compose ps (all should show healthy status)
4. Check individual health endpoints:
   - Backend: curl http://localhost:8000/health
   - Frontend: curl http://localhost:3000
5. Run smoke test: bash scripts/smoke-test.sh
6. Verify logs show no critical errors: docker-compose logs --tail=50
7. Document any issues found
8. Stop services: docker-compose down

**Constraints:**
- All services must show healthy status in docker-compose ps
- Smoke test must pass (exit code 0)
- No container restart loops should occur
- Health endpoint must return ok status

**Done when:** docker-compose ps shows all 7 services as healthy and smoke test exits with code 0

## Inputs

- `docker-compose.yml`
- `Dockerfile`
- `scripts/smoke-test.sh`
- `backend/Dockerfile`

## Expected Output

- Update the implementation and proof artifacts needed for this task.

## Verification

docker-compose ps | grep -c 'healthy' | xargs -I {} test {} -eq 7 && bash scripts/smoke-test.sh

## Observability Impact

Verification confirms all healthchecks work. Smoke test validates full API contract from S01-S04.
