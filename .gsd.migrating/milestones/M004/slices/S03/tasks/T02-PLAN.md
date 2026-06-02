---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T02: Add .txt support to AttachmentExtractor

## Why
The IMAP client's AttachmentExtractor currently only supports .pdf, .xls, .xlsx, .xlsm files. Bank statements use .txt extension (1C ClientBank format).

## Do
1. In `backend/services/imap_client.py`, add '.txt' to `AttachmentExtractor.SUPPORTED_EXTENSIONS`
2. No other changes needed—the extraction logic already handles any file type once supported

## Done when
- SUPPORTED_EXTENSIONS includes '.txt'
- is_supported_file() returns True for .txt files

## Inputs

- `backend/services/imap_client.py`

## Expected Output

- `backend/services/imap_client.py`

## Verification

python -c "from backend.services.imap_client import AttachmentExtractor; print('Supported:', AttachmentExtractor.SUPPORTED_EXTENSIONS); print('test.txt:', AttachmentExtractor.is_supported_file('test.txt'))"
