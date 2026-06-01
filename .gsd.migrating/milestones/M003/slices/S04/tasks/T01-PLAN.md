---
estimated_steps: 7
estimated_files: 1
skills_used: []
---

# T01: Add rapidfuzz dependency

## Why
RapidFuzz is required for fuzzy string matching to reconcile invoice items with project BOM items when SKUs or names differ slightly.

## Do
1. Add `rapidfuzz==3.9.0` to `backend/requirements.txt`
2. Verify the package is pure Python with no system dependencies

## Done when
- `backend/requirements.txt` contains `rapidfuzz==3.9.0`

## Inputs

- `backend/requirements.txt`

## Expected Output

- `backend/requirements.txt`

## Verification

grep rapidfuzz backend/requirements.txt

## Observability Impact

New dependency visible in requirements.txt for installation tracking
