---
id: T03
parent: S03
milestone: M004
key_files:
  - backend/email_worker.py
  - backend/tests/test_email_worker.py
key_decisions:
  - Followed existing pattern from publish_parse_task() for consistency
  - Used Path().suffix.lower() for robust extension checking regardless of case
  - Added bank_statements_processed to stats for observability of bank statement processing volume
duration: 
verification_result: passed
completed_at: 2026-06-02T09:29:48.436Z
blocker_discovered: false
---

# T03: Added routing logic to Email Worker for .txt bank statement files with new publish_bank_statement_task() method and stats tracking

**Added routing logic to Email Worker for .txt bank statement files with new publish_bank_statement_task() method and stats tracking**

## What Happened

Implemented T03: Add routing logic to Email Worker for .txt files

## Changes Made

1. **Added `publish_bank_statement_task()` method** (lines 168-206)
   - Follows the same pattern as `publish_parse_task()`
   - Imports `parse_bank_statement` task (to be implemented in T04)
   - Handles ImportError gracefully with mock logging for testing
   - Updates both `tasks_published` and `bank_statements_processed` stats

2. **Updated attachment routing logic** (lines 257-281)
   - Extracts file extension using `Path(filename).suffix.lower()`
   - Routes .txt files to `publish_bank_statement_task()`
   - Routes PDF/Excel files to `publish_parse_task()`
   - Logs appropriate messages for each routing path

3. **Added `bank_statements_processed` to stats tracking**
   - Initialized in `__init__` (line 77)
   - Incremented in both success paths of `publish_bank_statement_task()` (lines 193, 202)
   - Displayed in `print_stats()` method (line 327)

4. **Updated module docstring** to reflect bank statement processing capability

## Tests Added (5 new tests, 29 total passing)
- `test_publish_bank_statement_task_success`: Verifies successful task publication
- `test_publish_bank_statement_task_not_implemented`: Tests ImportError handling
- `test_publish_bank_statement_task_failure`: Tests error handling
- `test_process_email_with_txt_attachment_routes_to_bank_statement`: Verifies .txt routing
- `test_process_email_with_mixed_attachments`: Tests mixed invoice and bank statement attachments

## Verification Evidence
All three verification checks pass:
1. `publish_bank_statement_task` method exists
2. `.txt` file routing logic distinguishes from other files
3. `bank_statements_processed` stats tracking implemented

## Verification

Verification complete with all checks passing:
- `grep -q 'publish_bank_statement_task' backend/email_worker.py` -> PASS
- `grep -q '.txt' backend/email_worker.py` -> PASS
- `grep -q 'bank_statements_processed' backend/email_worker.py` -> PASS
- All 29 tests pass (5 new tests added for bank statement routing)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'publish_bank_statement_task' backend/email_worker.py && echo PASS || echo FAIL` | 0 | PASS | 100ms |
| 2 | `grep -q '.txt' backend/email_worker.py && echo PASS || echo FAIL` | 0 | PASS | 90ms |
| 3 | `grep -q 'bank_statements_processed' backend/email_worker.py && echo PASS || echo FAIL` | 0 | PASS | 80ms |
| 4 | `python -m pytest backend/tests/test_email_worker.py -v` | 0 | PASS (29/29 tests) | 2100ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/email_worker.py`
- `backend/tests/test_email_worker.py`
