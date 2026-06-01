---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T03: Create test fixtures for invoice parsing

Create backend/tests/fixtures/ directory and add test invoice files: test_simple_invoice.pdf (single-page PDF with sample table), test_dirty_invoice.xlsx (Excel with multiple sheets and merged cells for dirty table handling), and test_russian_invoice.pdf (PDF with Russian headers). These fixtures are required for integration tests and manual verification of PDF/Excel extraction.

## Inputs

- None specified.

## Expected Output

- `backend/tests/fixtures/test_simple_invoice.pdf`
- `backend/tests/fixtures/test_dirty_invoice.xlsx`
- `backend/tests/fixtures/test_russian_invoice.pdf`

## Verification

test -f D:/CLAUDE/Project/zakuppro/zakuppro/backend/tests/fixtures/test_simple_invoice.pdf && test -f D:/CLAUDE/Project/zakuppro/zakuppro/backend/tests/fixtures/test_dirty_invoice.xlsx && test -f D:/CLAUDE/Project/zakuppro/zakuppro/backend/tests/fixtures/test_russian_invoice.pdf
