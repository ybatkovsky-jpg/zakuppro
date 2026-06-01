---
estimated_steps: 12
estimated_files: 1
skills_used: []
---

# T01: Create Dockerfile for FastAPI container

## Why
Creates a production-ready multi-stage Dockerfile for the FastAPI backend. This enables containerization with minimal image size and proper dependency management.

## Do
1. Create `backend/Dockerfile` with multi-stage build:
   - **builder stage**: Python 3.11-slim base, install dependencies from requirements.txt
   - **final stage**: Copy installed packages from builder, create non-root app user
   - **WORKDIR**: /app
   - **CMD**: `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
2. Use Python 3.11-slim as base image (matches runtime in S03)
3. Expose port 8000 for API access

## Done when
Dockerfile exists and `docker build -t zakuppro-api backend/` completes without errors.

## Inputs

- `backend/requirements.txt`
- `backend/main.py`

## Expected Output

- `backend/Dockerfile`

## Verification

docker build -t zakuppro-api backend/ --progress plain

## Observability Impact

Docker build logs show dependency installation. Container startup logs show uvicorn binding to 0.0.0.0:8000.
