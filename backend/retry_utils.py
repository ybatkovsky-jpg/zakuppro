"""
Reusable retry decorators with exponential backoff + jitter.

Provides:
- retry_sync: For synchronous Telegram functions (time.sleep)
- retry_async: For async email functions (asyncio.sleep)

Existing LLM (llm_provider.py) and Celery retry remain unchanged.
"""

from __future__ import annotations

import asyncio
import functools
import logging
import random
import time
from typing import Callable, TypeVar

logger = logging.getLogger(__name__)

F = TypeVar("F", bound=Callable)


def retry_sync(
    max_retries: int = 3,
    base_delay: float = 1.0,
    retryable_exceptions: tuple[type[Exception], ...] = (Exception,),
):
    """Decorator: retry a synchronous function with exponential backoff + jitter.

    delay = base_delay * 2**attempt + random.uniform(0, 1)

    On each retryable failure, logs WARNING with function name, attempt number,
    and exception. When all retries exhausted, logs ERROR and returns False.
    Non-retryable exceptions propagate immediately.
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    logger.warning(
                        "Retry %d/%d for %s: %s",
                        attempt + 1, max_retries, func.__name__, e,
                    )
                    if attempt >= max_retries - 1:
                        logger.error(
                            "All retries exhausted for %s: %s",
                            func.__name__, e,
                        )
                        return False
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)
            return False

        return wrapper  # type: ignore[return-value]

    return decorator


def retry_async(
    max_retries: int = 3,
    base_delay: float = 1.0,
    retryable_exceptions: tuple[type[Exception], ...] = (Exception,),
):
    """Decorator: retry an async function with exponential backoff + jitter.

    delay = base_delay * 2**attempt + random.uniform(0, 1)

    On each retryable failure, logs WARNING with function name, attempt number,
    and exception. When all retries exhausted, logs ERROR and returns False.
    Non-retryable exceptions propagate immediately.
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    logger.warning(
                        "Retry %d/%d for %s: %s",
                        attempt + 1, max_retries, func.__name__, e,
                    )
                    if attempt >= max_retries - 1:
                        logger.error(
                            "All retries exhausted for %s: %s",
                            func.__name__, e,
                        )
                        return False
                    delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
                    await asyncio.sleep(delay)
            return False

        return wrapper  # type: ignore[return-value]

    return decorator
