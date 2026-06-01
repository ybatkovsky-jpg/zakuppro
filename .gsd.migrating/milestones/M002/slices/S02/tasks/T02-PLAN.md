---
estimated_steps: 13
estimated_files: 3
skills_used: []
---

# T02: Create backend/handlers package with auth middleware

### Why
Authorization middleware ensures only allowed chat_ids can use the bot per R001. handlers package organizes bot logic.

### Do
1. Create backend/handlers/__init__.py
2. Create backend/handlers/auth.py with AuthMiddleware class
3. load ALLOWED_CHAT_IDS from env, convert to set of ints
4. Implement async check_access(update, context) -> bool
5. Create backend/handlers/commands.py
6. Implement start_command and help_command async handlers
7. Each command should call auth.check_access first

### Done when
- handlers package imports without errors
- AuthMiddleware validates chat_ids from env

## Inputs

- `backend/celery_app.py`

## Expected Output

- `backend/handlers/__init__.py`
- `backend/handlers/auth.py`
- `backend/handlers/commands.py`

## Verification

python -c "from backend.handlers.auth import AuthMiddleware; from backend.handlers.commands import start_command; print('handlers import OK')"

## Observability Impact

Auth failures logged with chat_id
