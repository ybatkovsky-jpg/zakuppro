---
estimated_steps: 18
estimated_files: 3
skills_used: []
---

# T01: Create FastAPI main app with health check

## Why
Create the FastAPI application entry point that will serve all CRUD endpoints. This is the foundation for the API layer.

## Do
1. Create `backend/main.py` with:
   - FastAPI() instance with title='ZakupPro API', version='0.1.0'
   - GET /health endpoint that returns {'status': 'ok'}
   - Include routers placeholder (to be filled in T02)
   - CORS middleware for development origins
2. Create `backend/routers/__init__.py` as package marker
3. Create `backend/routers/health.py` with health check endpoint

## Constraints
- Use FastAPI 0.115.0 patterns (already in requirements.txt)
- Keep CORS open for development (restrict later in auth milestone)
- Health check should not require DB connection

## Done when
Server starts: `uvicorn backend.main:app --reload --port 8000`
Health endpoint returns 200: `curl http://localhost:8000/health` returns {'status': 'ok'}
Swagger UI accessible at http://localhost:8000/docs

## Inputs

- `backend/database.py`

## Expected Output

- `backend/main.py`
- `backend/routers/__init__.py`
- `backend/routers/health.py`

## Verification

uvicorn backend.main:app --reload --port 8000 &
sleep 3
curl -f http://localhost:8000/health
kill %1

## Observability Impact

Health check provides readiness probe; Swagger UI auto-docs from type hints; FastAPI logs requests to console.
