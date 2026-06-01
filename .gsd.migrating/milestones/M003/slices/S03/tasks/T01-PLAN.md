---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: Add pdfplumber dependency to requirements.txt

Add pdfplumber==0.11.4 to requirements.txt. This library is required by invoice_parser.py for PDF text extraction with table support. The invoice_parser.py service already imports and uses pdfplumber in its _extract_pdf_text() method (line 176), but the dependency is missing from requirements.txt, causing ImportError at runtime.

## Inputs

- `backend/requirements.txt`

## Expected Output

- `backend/requirements.txt`

## Verification

grep -q 'pdfplumber==0.11.4' D:/CLAUDE/Project/zakuppro/zakuppro/backend/requirements.txt
