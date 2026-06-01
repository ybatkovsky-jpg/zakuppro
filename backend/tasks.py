"""
Celery tasks for ZakupPro.

This module contains all background task definitions.
Tasks are automatically registered with the Celery app.
"""

from backend.celery_app import app
import logging

logger = logging.getLogger(__name__)


@app.task(name='tasks.dummy_health_check', bind=True)
def dummy_health_check(self):
    """
    Dummy health check task for testing Celery worker connectivity.

    This task serves as a simple way to verify that:
    1. Celery worker is running and can receive tasks
    2. Task execution completes successfully
    3. Results can be returned properly

    Usage:
        from backend.tasks import dummy_health_check
        result = dummy_health_check.delay()
        print(result.get(timeout=10))

    Returns:
        dict: Status message indicating the worker is alive
    """
    logger.info(f"Health check task {self.request.id} executing")

    result = {
        'status': 'ok',
        'message': 'Celery worker is alive',
        'task_id': self.request.id,
    }

    logger.info(f"Health check task {self.request.id} completed: {result}")
    return result


@app.task(name='tasks.add_numbers', bind=True)
def add_numbers(self, x, y):
    """
    Example task: add two numbers.

    Useful for testing basic task execution with parameters.

    Args:
        x: First number
        y: Second number

    Returns:
        int/float: Sum of x and y
    """
    logger.info(f"Task {self.request.id}: Adding {x} + {y}")
    result = x + y
    logger.info(f"Task {self.request.id}: Result = {result}")
    return result


@app.task(name='tasks.failing_task', bind=True, max_retries=3)
def failing_task(self, should_fail=True):
    """
    Example task that demonstrates retry behavior and DLQ.

    This task will fail and trigger retries. After max retries,
    the task will be moved to the DLQ for inspection.

    Args:
        should_fail: If True, task raises an exception

    Raises:
        ValueError: When should_fail is True
    """
    logger.info(f"Task {self.request.id} executing (retry {self.request.retries})")

    if should_fail:
        error_msg = "Task failed as requested"
        logger.warning(f"Task {self.request.id}: {error_msg}")
        raise ValueError(error_msg)

    return {'status': 'success', 'message': 'Task completed successfully'}
