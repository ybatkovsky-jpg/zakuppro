---
estimated_steps: 14
estimated_files: 1
skills_used: []
---

# T03: Create Telegram Notification Helper

## Why
Celery tasks need to send outbound messages to Telegram users (completion notifications) and owner (DLQ alerts). Existing handlers only reply to inbound messages.

## Do
1. Create `backend/telegram_notifier.py` with two functions:
   - `send_completion_message(chat_id, project_name, items_count, reserved_count)`: Sends success message with statistics
   - `send_dlq_alert(task_id, error_message, file_path)`: Sends alert to TELEGRAM_OWNER_CHAT_ID
2. Use python-telegram-bot `Bot` class with token from TELEGRAM_BOT_TOKEN env var
3. Include error handling for TelegramApiError with logging
4. Format messages in Russian with emojis for consistency
5. Add optional import guard for telegram.Bot availability

## Done when
- Module imports without errors
- Bot initialization uses env var
- Message format matches existing Telegram patterns

## Inputs

- None specified.

## Expected Output

- `backend/telegram_notifier.py`

## Verification

python -c "from backend.telegram_notifier import send_completion_message, send_dlq_alert; print('Module imported successfully')"
