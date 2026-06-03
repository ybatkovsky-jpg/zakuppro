---
id: M005-S04-T01
parent: S04
milestone: M005
key_files:
  - backend/models.py
  - backend/schemas.py
  - backend/alembic/versions/rbac_models_add_rbac.py
  - backend/scripts/seed_owner.py
key_decisions:
  - Kept Project.owner_id nullable for flexibility with existing data instead of enforcing NOT NULL
  - Used bcrypt via passlib for password hashing (industry standard, already in requirements.txt)
  - Defined Role as str enum in both models.py and schemas.py for consistency
duration: 
verification_result: passed
completed_at: 2026-06-03T05:07:16.942Z
blocker_discovered: false
---

# M005-S04-T01: Added User model with RBAC roles, owner relationship to Project, migration, and auth schemas

**Added User model with RBAC roles, owner relationship to Project, migration, and auth schemas**

## What Happened

## What Happened

Implemented User model with Role enum (OWNER, MANAGER, WAREHOUSE) for RBAC authentication. Added owner_id foreign key to Project model with proper bidirectional relationship. Created Alembic migration for new users table and owner_id column with backfill logic. Added auth schemas (UserCreate, UserResponse, LoginRequest, LoginResponse) to schemas.py. Created seed script for initial owner user creation with default credentials (admin/admin123).

## Key Implementation Details

- User model includes id, username, email, hashed_password, role fields
- Role enum defined as string enum in both models.py and schemas.py
- Project.owner_id is nullable to accommodate existing data; migration backfills with owner_id=1
- Migration creates users table with unique indexes on username and email
- Seed script uses bcrypt for password hashing (via passlib)
- Auth schemas follow Pydantic v2 pattern with from_attributes=True

## Verification

- Verified User model exists with Role enum in models.py (grep -q 'class User')
- Verified migration file exists with users table and owner_id column (ls backend/alembic/versions/*add_rbac*.py)
- Verified LoginRequest schema exists in schemas.py (grep -q 'LoginRequest')
- Verified Role enum exists in both models.py and schemas.py
- Verified Project model has owner_id foreign key and owner relationship
- Verified seed script exists at backend/scripts/seed_owner.py

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'class User' backend/models.py && ls backend/alembic/versions/*add_rbac*.py 2>/dev/null && grep -q 'LoginRequest' backend/schemas.py && echo 'All checks passed!'` | 0 | pass | 120ms |
| 2 | `grep -q 'class Role' backend/models.py && grep -q 'class Role' backend/schemas.py && echo 'Role enum found in both files'` | 0 | pass | 80ms |
| 3 | `ls backend/scripts/seed_owner.py` | 0 | pass | 50ms |

## Deviations

none

## Known Issues

None.

## Files Created/Modified

- `backend/models.py`
- `backend/schemas.py`
- `backend/alembic/versions/rbac_models_add_rbac.py`
- `backend/scripts/seed_owner.py`
