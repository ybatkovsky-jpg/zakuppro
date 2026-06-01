---
estimated_steps: 14
estimated_files: 1
skills_used: []
---

# T04: Create telegram_bot.py main application entry point

### Why
Entry point for running the bot service. Builds Application, registers handlers, starts polling.

### Do
1. Create backend/telegram_bot.py
2. Load env vars (TELEGRAM_BOT_TOKEN, ALLOWED_CHAT_IDS)
3. Build Application with token
4. Register handlers: start, help, document
5. Add error handler for exceptions
6. Run with application.run_polling()
7. Ensure /data/uploads directory exists on startup

### Done when
- Bot starts without errors
- Responds to /start from authorized chat_id
- Long polling runs continuously

## Inputs

- `backend/handlers/auth.py`
- `backend/handlers/commands.py`
- `backend/handlers/documents.py`

## Expected Output

- `backend/telegram_bot.py`

## Verification

python -c "import backend.telegram_bot; print('telegram_bot module OK')"

## Observability Impact

Bot startup/shutdown logged, polling status
