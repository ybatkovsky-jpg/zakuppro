---
estimated_steps: 27
estimated_files: 2
skills_used: []
---

# T01: Create retry_utils.py with sync and async retry decorators + unit tests

Why: The codebase has 4 separate manual retry implementations. A shared utility prevents divergence and gives a single place to test retry behavior. This task creates the foundation that T02 and T03 wire into.

Do:
1. Create backend/retry_utils.py with two decorators:
   - retry_sync(max_retries=3, base_delay=1, retryable_exceptions=(Exception,)): For sync Telegram functions. Uses time.sleep with exponential backoff (base_delay * 2**attempt) + random jitter (0-1s).
   - retry_async(max_retries=3, base_delay=1, retryable_exceptions=(Exception,)): For async email functions. Uses asyncio.sleep with same backoff formula.
2. Match existing codebase conventions:
   - Default max_retries=3 (matches llm_provider.py, ai_agent.py)
   - Default base_delay=1 (produces [1, 2, 4] delays, matching existing RETRY_DELAYS)
   - Jitter via random.uniform(0, 1) added per attempt
   - Log at WARNING each retry, ERROR when all exhausted
   - Return False when all retries exhausted (non-critical pattern from email/telegram modules)
   - Use functools.wraps to preserve function metadata
3. Create backend/tests/test_retry_utils.py with pytest tests:
   - test_retry_sync_success_first_try: decorated function succeeds immediately
   - test_retry_sync_retry_then_succeed: fails twice, succeeds on 3rd attempt
   - test_retry_sync_all_retries_exhausted: fails 3 times, returns False
   - test_retry_sync_non_retryable_exception: raises non-retryable error, does NOT retry
   - test_retry_sync_backoff_timing: verify delay increases (base*2**attempt)
   - test_retry_sync_jitter_present: verify jitter adds randomness
   - test_retry_async_success_first_try: (async version of above)
   - test_retry_async_retry_then_succeed
   - test_retry_async_all_retries_exhausted
   - test_retry_async_non_retryable_exception
   - test_retry_sync_preserves_function_metadata: @wraps preserves __name__, __doc__
   - test_retry_async_preserves_function_metadata
   - test_retry_sync_defaults: verify default max_retries=3, base_delay=1

Done when: All 13+ tests pass with `pytest backend/tests/test_retry_utils.py -v`

## Inputs

- `backend/llm_provider.py`

## Expected Output

- `backend/retry_utils.py`
- `backend/tests/test_retry_utils.py`

## Verification

pytest backend/tests/test_retry_utils.py -v
