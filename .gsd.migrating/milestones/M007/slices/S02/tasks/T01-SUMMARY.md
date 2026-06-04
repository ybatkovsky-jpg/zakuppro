---
id: T01
parent: S02
milestone: M007
key_files:
  - backend/retry_utils.py
  - backend/tests/test_retry_utils.py
key_decisions:
  - Return False (not raise) when all retries exhausted — matches existing non-critical failure pattern from email/telegram modules
  - Jitter is additive (base_delay * 2**attempt + random.uniform(0,1)), not multiplicative — matches explicit task spec
  - Default max_retries=3 and base_delay=1 match LLM_MAX_RETRIES and RETRY_DELAYS from llm_provider.py
duration: 
verification_result: passed
completed_at: 2026-06-04T22:04:12.057Z
blocker_discovered: false
---

# T01: Created retry_utils.py with sync and async exponential-backoff + jitter retry decorators, plus 13 passing unit tests

**Created retry_utils.py with sync and async exponential-backoff + jitter retry decorators, plus 13 passing unit tests**

## What Happened


## What Happened

Created `backend/retry_utils.py` with two decorators matching existing codebase conventions:
- `retry_sync(max_retries=3, base_delay=1.0, retryable_exceptions=(Exception,))` — for sync Telegram functions, uses `time.sleep` with exponential backoff `base_delay * 2**attempt + random.uniform(0, 1)` jitter
- `retry_async(max_retries=3, base_delay=1.0, retryable_exceptions=(Exception,))` — for async email functions, uses `asyncio.sleep` with same backoff formula

Design decisions:
- Default `max_retries=3` matches `LLM_MAX_RETRIES` from `llm_provider.py`
- Default `base_delay=1` produces `[1, 2, 4]` delays matching existing `RETRY_DELAYS`
- Returns `False` when all retries exhausted (non-critical failure pattern)
- `functools.wraps` preserves function metadata
- Logs WARNING on each retry (`"Retry N/M for func_name: exception"`), ERROR on exhaustion (`"All retries exhausted for func_name: exception"`)
- Non-retryable exceptions propagate immediately

Created `backend/tests/test_retry_utils.py` with 13 tests covering: success first try, retry-then-succeed, all exhausted, non-retryable propagation, backoff timing, jitter presence, metadata preservation (sync + async), and default parameter verification.

All 13 tests pass with `pytest backend/tests/test_retry_utils.py -v --noconftest`. The `--noconftest` flag is required because `conftest.py` has a database dependency chain (psycopg2) not available in this environment; the retry_utils tests need no database fixtures.


## Verification

Ran `pytest backend/tests/test_retry_utils.py -v --noconftest` — all 13 tests passed in 0.22s. Verified:
- retry_sync: success on first try, retry-then-succeed, exhaustion returns False, non-retryable propagates, backoff timing formula, jitter applied, metadata preserved, defaults correct
- retry_async: success on first try, retry-then-succeed, exhaustion returns False, non-retryable propagates, metadata preserved


## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pytest backend/tests/test_retry_utils.py -v --noconftest` | 0 | pass | 220ms |

## Deviations

Tests require --noconftest flag because conftest.py has a psycopg2 dependency not available in this environment. The retry_utils module has no database dependency.

## Known Issues

None.

## Files Created/Modified

- `backend/retry_utils.py`
- `backend/tests/test_retry_utils.py`
