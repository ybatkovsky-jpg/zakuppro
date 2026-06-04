"""
Tests for backend/retry_utils.py — sync and async retry decorators.

Covers:
- Success on first try (sync + async)
- Retry then succeed (sync + async)
- All retries exhausted returns False (sync + async)
- Non-retryable exception propagates immediately (sync + async)
- Backoff timing follows exponential formula
- Jitter adds randomness
- @wraps preserves function metadata (sync + async)
- Default parameter values
"""

import asyncio
import time
from unittest.mock import patch

import pytest

from backend.retry_utils import retry_sync, retry_async


# =============================================================================
# Helpers
# =============================================================================

class RetryableError(Exception):
    """Error the decorator should retry on."""


class NonRetryableError(Exception):
    """Error the decorator should NOT retry on."""


# =============================================================================
# retry_sync Tests
# =============================================================================

class TestRetrySync:

    # -- success first try --------------------------------------------------

    def test_retry_sync_success_first_try(self):
        """Decorated function succeeds on first call, no sleeps."""
        called = []

        @retry_sync()
        def succeed():
            called.append(1)
            return "ok"

        with patch("backend.retry_utils.time.sleep") as mock_sleep:
            result = succeed()

        assert result == "ok"
        assert called == [1]
        mock_sleep.assert_not_called()

    # -- retry then succeed -------------------------------------------------

    def test_retry_sync_retry_then_succeed(self):
        """Fails twice, succeeds on 3rd attempt."""
        failures = [RetryableError("a"), RetryableError("b"), None]

        @retry_sync()
        def flaky():
            val = failures.pop(0)
            if isinstance(val, Exception):
                raise val
            return val

        with patch("backend.retry_utils.time.sleep"):
            result = flaky()

        assert result is None
        assert failures == []  # consumed all

    # -- all retries exhausted ----------------------------------------------

    def test_retry_sync_all_retries_exhausted(self):
        """Fails every attempt (3 total), returns False."""

        @retry_sync()
        def always_fail():
            raise RetryableError("boom")

        with patch("backend.retry_utils.time.sleep"):
            result = always_fail()

        assert result is False

    # -- non-retryable exception --------------------------------------------

    def test_retry_sync_non_retryable_exception(self):
        """Non-retryable error propagates immediately — no retry."""

        @retry_sync(retryable_exceptions=(RetryableError,))
        def raises_wrong():
            raise NonRetryableError("fatal")

        with patch("backend.retry_utils.time.sleep") as mock_sleep:
            with pytest.raises(NonRetryableError, match="fatal"):
                raises_wrong()

        mock_sleep.assert_not_called()

    # -- backoff timing -----------------------------------------------------

    def test_retry_sync_backoff_timing(self):
        """Verify delay = base_delay * 2**attempt, ignoring jitter."""
        delays = []

        @retry_sync()
        def always_fail():
            raise RetryableError("boom")

        def fake_sleep(s):
            delays.append(s)

        # Force jitter to 0 so we only measure exponential component
        with patch("backend.retry_utils.time.sleep", side_effect=fake_sleep), \
             patch("backend.retry_utils.random.uniform", return_value=0.0):
            always_fail()

        # base_delay=1 → delays [1*2^0, 1*2^1] = [1, 2] (2 sleeps for 3 attempts)
        assert len(delays) == 2
        assert delays[0] == pytest.approx(1.0)
        assert delays[1] == pytest.approx(2.0)

    # -- jitter -------------------------------------------------------------

    def test_retry_sync_jitter_present(self):
        """Jitter is added to each delay."""
        uniform_calls = []

        @retry_sync()
        def always_fail():
            raise RetryableError("boom")

        def fake_uniform(a, b):
            uniform_calls.append((a, b))
            return 0.5

        with patch("backend.retry_utils.time.sleep"), \
             patch("backend.retry_utils.random.uniform", side_effect=fake_uniform):
            always_fail()

        # uniform called for each retry delay (2 sleeps for max_retries=3)
        assert len(uniform_calls) == 2
        for a, b in uniform_calls:
            assert a == 0
            assert b == 1

    # -- preserves function metadata ----------------------------------------

    def test_retry_sync_preserves_function_metadata(self):
        """@wraps preserves __name__ and __doc__."""

        @retry_sync()
        def my_func(x: int) -> str:
            """Docstring for my_func."""
            return str(x)

        assert my_func.__name__ == "my_func"
        assert my_func.__doc__ == "Docstring for my_func."

    # -- defaults -----------------------------------------------------------

    def test_retry_sync_defaults(self):
        """Verify default max_retries=3, base_delay=1 via behavior."""
        call_count = []

        @retry_sync()
        def tracked():
            call_count.append(1)
            raise RetryableError("fail")

        delays = []
        def fake_sleep(s):
            delays.append(s)

        with patch("backend.retry_utils.time.sleep", side_effect=fake_sleep), \
             patch("backend.retry_utils.random.uniform", return_value=0.0):
            result = tracked()

        assert result is False
        # 3 total calls (max_retries=3), 2 sleeps
        assert len(call_count) == 3
        assert len(delays) == 2
        # base_delay=1 → [1*2^0, 1*2^1] = [1, 2]
        assert delays[0] == pytest.approx(1.0)
        assert delays[1] == pytest.approx(2.0)


# =============================================================================
# retry_async Tests
# =============================================================================

class TestRetryAsync:

    # -- success first try --------------------------------------------------

    @pytest.mark.asyncio
    async def test_retry_async_success_first_try(self):
        """Decorated async function succeeds on first call."""
        called = []

        @retry_async()
        async def succeed():
            called.append(1)
            return "ok"

        with patch("backend.retry_utils.asyncio.sleep") as mock_sleep:
            result = await succeed()

        assert result == "ok"
        assert called == [1]
        mock_sleep.assert_not_called()

    # -- retry then succeed -------------------------------------------------

    @pytest.mark.asyncio
    async def test_retry_async_retry_then_succeed(self):
        """Fails twice, succeeds on 3rd attempt."""
        failures = [RetryableError("a"), RetryableError("b"), None]

        @retry_async()
        async def flaky():
            val = failures.pop(0)
            if isinstance(val, Exception):
                raise val
            return val

        with patch("backend.retry_utils.asyncio.sleep"):
            result = await flaky()

        assert result is None
        assert failures == []

    # -- all retries exhausted ----------------------------------------------

    @pytest.mark.asyncio
    async def test_retry_async_all_retries_exhausted(self):
        """Fails every attempt, returns False."""

        @retry_async()
        async def always_fail():
            raise RetryableError("boom")

        with patch("backend.retry_utils.asyncio.sleep"):
            result = await always_fail()

        assert result is False

    # -- non-retryable exception --------------------------------------------

    @pytest.mark.asyncio
    async def test_retry_async_non_retryable_exception(self):
        """Non-retryable error propagates immediately."""

        @retry_async(retryable_exceptions=(RetryableError,))
        async def raises_wrong():
            raise NonRetryableError("fatal")

        with patch("backend.retry_utils.asyncio.sleep") as mock_sleep:
            with pytest.raises(NonRetryableError, match="fatal"):
                await raises_wrong()

        mock_sleep.assert_not_called()

    # -- preserves function metadata ----------------------------------------

    @pytest.mark.asyncio
    async def test_retry_async_preserves_function_metadata(self):
        """@wraps preserves __name__ and __doc__ for async functions."""

        @retry_async()
        async def my_async_func(x: int) -> str:
            """Async docstring."""
            return str(x)

        assert my_async_func.__name__ == "my_async_func"
        assert my_async_func.__doc__ == "Async docstring."
