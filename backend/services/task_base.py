"""
Base class for Celery tasks with built-in DLQ, DB session, and retry management.

Eliminates the copy-pasted try/except/finally pattern that was duplicated across
every task in tasks.py. Each task now only needs to implement `execute()` and
optionally override `task_name` and `on_rate_limit()`.

Usage:
    class MyTask(BaseTask):
        task_name = 'tasks.my_task'

        def execute(self, db, **kwargs):
            # Business logic only — no DLQ/session/retry boilerplate
            ...

    @app.task(name='tasks.my_task', bind=True, base=BaseTask, max_retries=2)
    def my_task(self, **kwargs):
        return self.run_with_context(**kwargs)
"""

from __future__ import annotations

import json
import logging
import traceback
from abc import ABC
from contextlib import contextmanager
from typing import Any, Optional

from celery import Task

logger = logging.getLogger(__name__)


class BaseTask(Task, ABC):
    """
    Abstract base Celery task that provides:

    1. Automatic DB session lifecycle (create / commit / close)
    2. Structured DLQ persistence on failure (FailedTask record)
    3. Exponential backoff retry on RateLimitError
    4. Consistent error logging with task_id tracking
    5. Telegram DLQ alert notification

    Subclasses must:
    - Set `task_name` class attribute
    - Implement `execute(db, **kwargs) -> dict`

    Subclasses may override:
    - `on_rate_limit(error)` — custom rate-limit handling (default: retry)
    - `get_dlq_context(**kwargs) -> dict` — context stored in FailedTask
    - `get_dlq_file_path(**kwargs) -> Optional[str]` — file path for FailedTask
    - `get_dlq_chat_id(**kwargs) -> Optional[int]` — chat_id for FailedTask
    """

    task_name: str = "tasks.base"
    abstract = True  # Prevent Celery from registering this as a runnable task

    # ------------------------------------------------------------------
    # Public entry point — replaces the old try/except/finally boilerplate
    # ------------------------------------------------------------------

    def run_with_context(self, **kwargs) -> dict:
        """
        Orchestration wrapper: session, DLQ, retry, logging.

        This is the ONLY method that should be called from the @app.task
        decorated function.  It handles:

        - Creating and closing the DB session
        - Calling self.execute() with the session
        - On RateLimitError → retry with exponential backoff
        - On any Exception → persist FailedTask, send DLQ alert, re-raise
        """
        task_id = self.request.id
        retry_count = self.request.retries

        logger.info(
            "Task %s (%s) started — retry=%s, args=%s",
            task_id, self.task_name, retry_count, kwargs,
        )

        with self._db_session() as db:
            try:
                result = self.execute(db, **kwargs)
                logger.info("Task %s (%s) completed successfully", task_id, self.task_name)
                return result

            except self._rate_limit_error_classes() as e:
                return self._handle_rate_limit(task_id, e, **kwargs)

            except Exception as e:
                self._handle_failure(task_id, db, e, **kwargs)
                raise  # Re-raise for Celery's own DLQ

    # ------------------------------------------------------------------
    # Abstract — subclasses MUST implement
    # ------------------------------------------------------------------

    def execute(self, db, **kwargs) -> dict:
        """
        Business logic of the task.  Receives an active DB session.

        Must return a dict (JSON-serialisable Celery result).

        Raise:
        - RateLimitError subclass → automatic retry with backoff
        - Any other Exception → DLQ record + re-raise
        """
        raise NotImplementedError("Subclasses must implement execute()")

    # ------------------------------------------------------------------
    # Overridable hooks
    # ------------------------------------------------------------------

    def get_dlq_context(self, **kwargs) -> dict:
        """Return serialisable context dict for the FailedTask record."""
        # Sanitise: drop any bytes values (not JSON-serialisable)
        safe = {}
        for k, v in kwargs.items():
            if isinstance(v, bytes):
                safe[k] = f"<bytes len={len(v)}>"
            else:
                safe[k] = v
        return safe

    def get_dlq_file_path(self, **kwargs) -> Optional[str]:
        """Return file_path for FailedTask record (or None)."""
        return kwargs.get("file_path")

    def get_dlq_chat_id(self, **kwargs) -> Optional[int]:
        """Return chat_id for FailedTask record (or None)."""
        return kwargs.get("chat_id")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @contextmanager
    def _db_session(self):
        """Context manager that yields a Session and always closes it."""
        from backend.database import SessionLocal

        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
            logger.debug("DB session closed for task %s", self.request.id)

    def _rate_limit_error_classes(self) -> tuple:
        """Tuple of exception classes that trigger retry."""
        try:
            from openai import RateLimitError as OpenAIRateLimitError
            return (OpenAIRateLimitError,)
        except ImportError:
            return ()

    def _handle_rate_limit(self, task_id: str, error: Exception, **kwargs):
        """Retry with exponential backoff on rate-limit errors."""
        retry_count = self.request.retries
        countdown = 2 ** retry_count  # 1, 2, 4…
        logger.warning(
            "Task %s (%s): rate limit hit, retrying in %ds (attempt %d)",
            task_id, self.task_name, countdown, retry_count + 1,
        )
        raise self.retry(exc=error, countdown=countdown)

    def _handle_failure(
        self,
        task_id: str,
        db,
        error: Exception,
        **kwargs,
    ) -> None:
        """Persist FailedTask record and send DLQ alert."""
        error_message = (
            f"{type(error).__name__}: {str(error)}\n\n"
            f"{traceback.format_exc()}"
        )
        logger.error("Task %s (%s) FAILED: %s", task_id, self.task_name, error_message)

        try:
            from backend.models import FailedTask
            from backend.telegram_notifier import send_dlq_alert

            failed_task = FailedTask(
                task_id=task_id,
                task_name=self.task_name,
                error_message=error_message,
                error_type=type(error).__name__,
                file_path=self.get_dlq_file_path(**kwargs),
                chat_id=self.get_dlq_chat_id(**kwargs),
                context=json.dumps(self.get_dlq_context(**kwargs)),
            )
            db.add(failed_task)
            db.commit()
            logger.info("Task %s: FailedTask record created", task_id)

            # DLQ alert (fire-and-forget, don't block on failure)
            try:
                send_dlq_alert(
                    task_id=task_id,
                    error_message=str(error),
                    file_path=self.get_dlq_file_path(**kwargs) or "",
                    chat_id=self.get_dlq_chat_id(**kwargs),
                )
            except Exception as alert_err:
                logger.error(
                    "Task %s: Failed to send DLQ alert: %s", task_id, alert_err,
                )

        except Exception as inner:
            logger.error(
                "Task %s: Failed to persist FailedTask record: %s", task_id, inner,
            )
