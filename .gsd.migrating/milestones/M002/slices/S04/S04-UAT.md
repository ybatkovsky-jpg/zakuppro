# S04: S04: Project Creation + DLQ — UAT

**Milestone:** M002
**Written:** 2026-06-01T11:38:36.498Z

# S04: End-to-End BOM Upload Flow - UAT

## UAT Type
**End-to-End Integration UAT** - Verifies complete user journey from Excel upload to Project creation with DLQ handling

## Preconditions
1. Docker stack running: `docker-compose up -d` (rabbitmq, celery-worker, telegram-bot)
2. Environment variables set: `TELEGRAM_BOT_TOKEN`, `ALLOWED_CHAT_IDS`, `TELEGRAM_OWNER_CHAT_ID`, `OPENAI_API_KEY`
3. Database migrated with `failed_tasks` table
4. User has valid `chat_id` in `ALLOWED_CHAT_IDS`

## Test Cases

### TC01: Successful BOM Upload → Project in DB

**Steps:**
1. Send Excel file with BOM data to Telegram Bot
2. Wait for Celery task processing
3. Check Telegram completion message
4. Verify Project created in database

**Expected Outcomes:**
- User receives Telegram message: "✅ Проект '{name}' успешно создан. 📊 Позиций: {n}, 📦 Резервировано: {r}"
- Database contains Project record with matching name
- Project has ProjectItem records with supplier_id mapped
- Supplier names auto-resolved to supplier_id (existing or newly created with placeholder email)

**Evidence:**
- Celery logs: "Project {project_id} created with {items_count} items"
- Database query: `SELECT * FROM projects WHERE name = '{project_name}';`
- Telegram message history

---

### TC02: DLQ Handling on Parse Error

**Steps:**
1. Send malformed/corrupted Excel file to Telegram Bot
2. Wait for Celery task retry exhaustion
3. Check failed_tasks table
4. Verify owner receives DLQ alert

**Expected Outcomes:**
- `failed_tasks` table contains record with: task_id, task_name='parse_excel_bom', error_message with traceback, file_path, chat_id, context JSON
- Telegram owner receives alert: "⚠️ DLQ Alert: Task {task_id} failed"
- User chat_id preserved for potential manual retry

**Evidence:**
- Database query: `SELECT * FROM failed_tasks ORDER BY created_at DESC LIMIT 1;`
- Owner Telegram message with error details
- Celery logs with retry attempts

---

### TC03: Supplier Name Auto-Creation

**Steps:**
1. Send Excel with new supplier name (not in suppliers table)
2. Check suppliers table after processing

**Expected Outcomes:**
- New supplier created with name from Excel
- Email auto-generated: `auto-{slugify(name)}@placeholder.com`
- ProjectItem records reference new supplier_id

**Evidence:**
- Database query: `SELECT * FROM suppliers WHERE email LIKE 'auto-%@placeholder.com';`

---

### TC04: Empty Supplier Name Handling

**Steps:**
1. Send Excel with missing/empty supplier names in some rows
2. Verify processing completes

**Expected Outcomes:**
- Rows with empty supplier names skipped (supplier_id = NULL)
- Remaining items processed successfully
- No task failure

**Evidence:**
- ProjectItem records with some supplier_id = NULL
- Successful completion message

---

## Not Proven By This UAT

**Manual UI Testing**: This UAT covers Telegram → DB flow. Frontend UI (M005) project viewing not included.

**Retry Mechanics**: Exponential backoff retry timing and RabbitMQ DLQ queue behavior would require infrastructure-level testing with injected failures.

**Concurrent Uploads**: Multiple simultaneous Excel uploads not tested. May require database transaction isolation verification.

**Large File Handling**: Files >10MB or >1000 rows not tested. May require Celery timeout tuning.

## Edge Cases Covered

| Case | Expected Behavior |
|------|-------------------|
| Missing metadata.project_name | Use file stem as project name |
| Empty supplier name | Skip supplier resolution (NULL supplier_id) |
| Telegram API unavailable | Task continues, notification fails gracefully |
| Database connection lost | Task retries, then creates FailedTask record |
| Duplicate supplier name | Returns existing supplier_id (no duplicate created) |

## Open Questions for Next Milestone

1. Should failed tasks in DLQ be manually reprocessable via admin command?
2. What is the maximum file size/row count limit for Excel uploads?
3. Should Telegram notifications be queued for retry on failure?
