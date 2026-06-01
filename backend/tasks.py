"""
Celery tasks for ZakupPro.

This module contains all background task definitions.
Tasks are automatically registered with the Celery app.
"""

from backend.celery_app import app
import logging

from openai import RateLimitError
from backend.excel_parser import read_excel_file, clean_dataframe, dataframe_to_markdown
from backend.ai_agent import extract_bom_structure, ExtractedBOM

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


@app.task(name='tasks.queue_excel_processing', bind=True)
def queue_excel_processing(self, file_path: str, chat_id: int) -> dict:
    """
    Queue Excel file for asynchronous processing.

    This task is triggered when a user uploads an Excel file via Telegram.
    It validates the file exists and is accessible, then returns processing
    confirmation.

    The actual Excel parsing and database import logic will be implemented
    in subsequent tasks.

    Args:
        file_path: Absolute path to the uploaded Excel file
        chat_id: Telegram chat_id of the user who uploaded the file

    Returns:
        dict: Processing status with task_id and file info

    Raises:
        FileNotFoundError: If the file_path does not exist
        ValueError: If the file is not a valid Excel file
    """
    import os
    logger.info(f"Task {self.request.id}: Processing Excel file: {file_path} from chat_id={chat_id}")

    # Validate file exists
    if not os.path.exists(file_path):
        error_msg = f"File not found: {file_path}"
        logger.error(f"Task {self.request.id}: {error_msg}")
        raise FileNotFoundError(error_msg)

    # Validate file extension
    if not file_path.lower().endswith(('.xlsx', '.xls')):
        error_msg = f"Invalid file extension: {file_path}"
        logger.error(f"Task {self.request.id}: {error_msg}")
        raise ValueError(error_msg)

    file_size = os.path.getsize(file_path)
    logger.info(
        f"Task {self.request.id}: File validated - "
        f"path={file_path}, size={file_size} bytes, chat_id={chat_id}"
    )

    # TODO: Implement actual Excel parsing and database import
    # This is a placeholder that confirms the task was received

    result = {
        'status': 'queued',
        'task_id': self.request.id,
        'file_path': file_path,
        'file_size': file_size,
        'chat_id': chat_id,
        'message': 'Excel file queued for processing'
    }

    logger.info(f"Task {self.request.id}: Completed - {result}")
    return result


@app.task(name='tasks.parse_excel_bom', bind=True, max_retries=2)
def parse_excel_bom(self, file_path: str, chat_id: int) -> dict:
    """
    Parse Excel file and extract BOM structure using GPT-4o.

    This task executes the full Excel parsing pipeline:
    1. Reads Excel file with pandas
    2. Cleans the dataframe (removes empty rows/columns, normalizes text)
    3. Converts to markdown format for AI processing
    4. Calls OpenAI GPT-4o for structured BOM extraction
    5. Validates output with Pydantic model
    6. Returns JSON-serializable result

    On rate limit errors, task retries with exponential backoff.
    After max_retries=2 is exhausted, task goes to DLQ for inspection.

    Args:
        file_path: Absolute path to the uploaded Excel file
        chat_id: Telegram chat_id of the user who uploaded the file

    Returns:
        dict: Result with keys:
            - status: 'success' or 'error'
            - items_count: Number of extracted BOM items
            - items: List of dicts with sku, name, qty, supplier
            - metadata: Optional dict with project_name, client
            - task_id: Celery task ID

    Raises:
        FileNotFoundError: If Excel file doesn't exist
        ValueError: If validation fails (goes to DLQ)
        RateLimitError: Triggers retry with exponential backoff
    """
    logger.info(
        f"Task {self.request.id}: parse_excel_bom started - "
        f"file={file_path}, chat_id={chat_id}, retry={self.request.retries}"
    )

    try:
        # Step 1: Read Excel file
        logger.info(f"Task {self.request.id}: Reading Excel file")
        df = read_excel_file(file_path)
        logger.info(f"Task {self.request.id}: Excel read successful, {len(df)} rows")

        # Step 2: Clean dataframe
        logger.info(f"Task {self.request.id}: Cleaning dataframe")
        df_clean = clean_dataframe(df)
        logger.info(f"Task {self.request.id}: Dataframe cleaned, {len(df_clean)} data rows")

        # Step 3: Convert to markdown
        logger.info(f"Task {self.request.id}: Converting to markdown")
        markdown = dataframe_to_markdown(df_clean)
        logger.info(f"Task {self.request.id}: Markdown generated ({len(markdown)} chars)")

        # Step 4: Extract BOM with AI
        logger.info(f"Task {self.request.id}: Calling GPT-4o for BOM extraction")
        extracted = extract_bom_structure(markdown)
        logger.info(f"Task {self.request.id}: AI extraction completed")

        # Step 5: Validate with Pydantic
        validated = ExtractedBOM.model_validate(extracted)
        logger.info(
            f"Task {self.request.id}: Validation passed - "
            f"{len(validated.items)} items extracted"
        )

        # Return JSON-serializable result
        result = {
            'status': 'success',
            'items_count': len(validated.items),
            'items': [item.model_dump() for item in validated.items],
            'metadata': validated.metadata.model_dump() if validated.metadata else {},
            'task_id': self.request.id,
        }

        logger.info(f"Task {self.request.id}: parse_excel_bom completed successfully")
        return result

    except RateLimitError as e:
        # Retry with exponential backoff
        retry_count = self.request.retries
        countdown = 2 ** retry_count  # 1, 2, 4...
        logger.warning(
            f"Task {self.request.id}: Rate limit hit, "
            f"retrying in {countdown}s (attempt {retry_count + 1}/3)"
        )
        raise self.retry(exc=e, countdown=countdown, max_retries=2)

    except ValueError as e:
        # Validation error - don't retry, goes to DLQ
        logger.error(
            f"Task {self.request.id}: Validation failed - {e}"
        )
        raise

    except Exception as e:
        # Unexpected error - log and raise (goes to DLQ)
        logger.error(
            f"Task {self.request.id}: Unexpected error - {e}",
            exc_info=True
        )
        raise
