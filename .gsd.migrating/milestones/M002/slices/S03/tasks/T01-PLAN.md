---
estimated_steps: 18
estimated_files: 1
skills_used: []
---

# T01: Create Excel Parser Module

## Why
Create reusable Excel reading utilities for dirty invoice tables. Pandas reads raw data; cleanup logic handles merged cells, empty rows, and multi-line headers. This module produces clean CSV for AI processing.

## Do
1. Create `backend/excel_parser.py` with:
   - `read_excel_file(path: str) -> pd.DataFrame`: Basic read with openpyxl engine
   - `detect_header_row(df: pd.DataFrame) -> int`: Finds first non-empty row with column-like content
   - `clean_dataframe(df: pd.DataFrame) -> pd.DataFrame`: Drops empty rows/columns, strips whitespace, fills NaN
   - `dataframe_to_markdown(df: pd.DataFrame) -> str`: Converts to markdown table (alternatively CSV)

2. Handle dirty patterns:
   - Skip N rows to find real header
   - Drop rows where all values are NaN
   - Drop columns where all values are NaN
   - Strip whitespace from string columns

3. Add docstrings and type hints. Use pandas 2.2.3 patterns (already in requirements.txt).

## Constraints
- Use existing openpyxl==3.1.5 dependency
- No LLM calls in this module (data prep only)
- Return markdown for AI input (CSV is simpler but markdown preserves table structure better)

## Inputs

- `backend/requirements.txt`

## Expected Output

- `backend/excel_parser.py`

## Verification

python -c "from backend.excel_parser import read_excel_file, clean_dataframe, dataframe_to_markdown; print('Module loads successfully')"
