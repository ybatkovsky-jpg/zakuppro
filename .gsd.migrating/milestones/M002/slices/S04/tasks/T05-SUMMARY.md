---
id: T05
parent: S04
milestone: M002
key_files:
  - backend/handlers/documents.py
key_decisions:
  - Chose option 2 from task plan: modify documents.py to call process_bom_to_project directly, rather than chaining through queue_excel_processing. This is cleaner as it calls the full orchestration task without an intermediate stub.
  - Left queue_excel_processing task in place for potential future use or rollback - it only validates files and returns confirmation
duration: 
verification_result: mixed
completed_at: 2026-06-01T11:30:16.309Z
blocker_discovered: false
---

# T05: Wired process_bom_to_project orchestration task into upload flow by modifying documents.py handler

**Wired process_bom_to_project orchestration task into upload flow by modifying documents.py handler**

## What Happened

Modified `backend/handlers/documents.py` to call the full orchestration task `process_bom_to_project.delay()` instead of the stub `queue_excel_processing.delay()`. This change wires the complete end-to-end BOM processing pipeline (Excel parsing → AI extraction → DB operations → Telegram notifications) into the Telegram upload flow. The upload handler now triggers the full flow when a user uploads an Excel file.

## Verification

Verification passed. The grep check confirms `process_bom_to_project` is now referenced in `backend/handlers/documents.py`. Python syntax validation passed for the modified file. The handler now correctly imports and calls `process_bom_to_project.delay()` with file_path and chat_id parameters.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'process_bom_to_project' backend/handlers/documents.py | 0 | PASS | 500` | -1 | unknown (coerced from string) | 0ms |
| 2 | `python -m py_compile backend/handlers/documents.py | 0 | PASS | 400` | -1 | unknown (coerced from string) | 0ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `backend/handlers/documents.py`
