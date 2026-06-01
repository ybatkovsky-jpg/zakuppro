# S02: Telegram Bot Gateway — UAT

**Milestone:** M002
**Written:** 2026-06-01T10:55:31.008Z

# UAT: Telegram Bot Gateway (S02)

## UAT Type
**Integration Verification** - Verifies bot service accepts uploads and publishes tasks

## Preconditions
1. Docker Comstack running: `docker-compose up -d rabbitmq telegram-bot`
2. `.env` configured with valid `TELEGRAM_BOT_TOKEN` and `ALLOWED_CHAT_IDS`
3. Tester's chat_id included in `ALLOWED_CHAT_IDS`

## Test Cases

### TC1: Unauthorized Access Rejection
**Steps:**
1. Use a Telegram account NOT in `ALLOWED_CHAT_IDS`
2. Send `/start` command to the bot

**Expected Result:**
- Bot responds with "⛔ Access denied. You are not authorized to use this bot."
- Log entry: `Document upload denied: chat_id not allowed` or similar warning

### TC2: Authorized Start Command
**Steps:**
1. Use an authorized Telegram account (chat_id in ALLOWED_CHAT_IDS)
2. Send `/start` command

**Expected Result:**
- Bot responds with welcome message: "👋 Welcome to ZakupPro BOM Bot!"
- No authorization warnings in logs

### TC3: Excel File Upload - Success
**Steps:**
1. Using authorized account, upload an Excel file (.xlsx or .xls) under 20MB
2. Verify bot response

**Expected Result:**
- Bot replies with: "✅ File received!" and includes:
  - File name
  - File size in KB
  - Task ID in monospace format
- Log entries show:
  - `Document upload received: file_name=..., file_size=..., chat_id=...`
  - `File saved: /data/uploads/...`
  - `Task published: task_id=..., file_path=..., chat_id=...`

### TC4: File Upload - Invalid Format
**Steps:**
1. Using authorized account, upload a non-Excel file (e.g., .pdf, .jpg)

**Expected Result:**
- Bot responds with: "❌ Invalid file format. Please send Excel files (.xlsx or .xls) only."
- Log warning: `Invalid file extension: ...`

### TC5: File Upload - Oversized File
**Steps:**
1. Using authorized account, upload an Excel file larger than 20MB

**Expected Result:**
- Bot responds with: "❌ File too large. Maximum size: 20MB. Your file: XX.XXMB"
- Log warning: `File too large: ...`

### TC6: Docker Volume Persistence
**Steps:**
1. Upload an Excel file via bot
2. Restart telegram-bot container: `docker-compose restart telegram-bot`
3. Check uploads volume: `docker exec telegram-bot ls /data/uploads`

**Expected Result:**
- Previously uploaded file remains in `/data/uploads` after container restart

## Edge Cases Covered

| Case | Handling |
|------|----------|
| Duplicate filename | Appends Unix timestamp: `file_1234567890.xlsx` |
| Missing file in update | Returns early with warning log |
| Telegram download failure | Caught by exception handler, user notified |
| Empty ALLOWED_CHAT_IDS | Auth denies all (empty set) |

## Not Proven By This UAT

- Actual Excel parsing (implemented in S03)
- Project creation in database (implemented in S04)
- DLQ behavior (implemented in S04)
- End-to-end response notification (implemented in S04)
