---
estimated_steps: 22
estimated_files: 2
skills_used: []
---

# T02: Implement Project CRUD router

## Why
Project is the core entity with relationships (items, purchase_orders, production_tasks). Implementing it first establishes the CRUD pattern for other entities and validates the eager-loading strategy.

## Do
1. Create `backend/routers/projects.py` with standard CRUD endpoints:
   - GET /api/projects/ — list all projects with pagination (skip/limit)
   - GET /api/projects/{id} — get single project with eager-loaded items using selectinload
   - POST /api/projects/ — create project using ProjectCreate schema
   - PUT /api/projects/{id} — update project using ProjectUpdate schema
   - DELETE /api/projects/{id} — delete project (cascade verified in tests)
2. Use `get_db()` dependency for session management
3. Return appropriate HTTP status codes: 404 for not found, 422 for validation errors
4. Include router in main.py

## Constraints
- Use `selectinload(Project.items)` in GET detail endpoint to prevent N+1 queries
- Use ProjectCreate, ProjectUpdate, ProjectResponse schemas from schemas.py
- Call `db.commit()` after add/delete operations
- Return created/updated object with assigned id

## Done when
All endpoints appear in Swagger UI
POST creates project returned with id
GET /api/projects/{id} includes items array
DELETE removes project and cascade deletes items

## Inputs

- `backend/models.py`
- `backend/schemas.py`
- `backend/database.py`
- `backend/main.py`

## Expected Output

- `backend/routers/projects.py`
- `backend/main.py`

## Verification

python -c "from backend.main import app; from backend.routers import projects; print('Project router loaded')"
grep -q 'projects' backend/main.py

## Observability Impact

Project CRUD endpoints expose HTTP API; selectinload prevents N+1 queries visible in SQL logs.
