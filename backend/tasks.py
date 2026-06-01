"""
Celery tasks for ZakupPro.

This module contains all background task definitions.
Tasks are automatically registered with the Celery app.
"""

from backend.celery_app import app
import logging
import json
import traceback
from typing import Optional

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


@app.task(name='tasks.process_bom_to_project', bind=True, max_retries=2)
def process_bom_to_project(self, file_path: str, chat_id: int) -> dict:
    """
    Main orchestration task for BOM to Project workflow.

    This task chains the entire flow:
    1. Parse Excel file with AI (calls parse_excel_bom synchronously)
    2. Create Supplier records (auto-create if needed)
    3. Create Project record
    4. Create ProjectItem records for each extracted item
    5. Send Telegram completion message
    6. Handle errors with DLQ persistence and alerts

    On transient errors, task retries with exponential backoff.
    After max_retries=2, task goes to DLQ with FailedTask record.

    Args:
        file_path: Absolute path to the uploaded Excel file
        chat_id: Telegram chat_id of the user who uploaded the file

    Returns:
        dict: Result with keys:
            - status: 'success' or 'error'
            - project_id: ID of created project
            - items_count: Number of ProjectItems created
            - reserved_count: Number of reserved items (always 0 for now)
            - task_id: Celery task ID

    Raises:
        FileNotFoundError: If Excel file doesn't exist
        ValueError: If validation fails or no items extracted
        RateLimitError: Triggers retry with exponential backoff
    """
    task_id = self.request.id
    logger.info(
        f"Task {task_id}: process_bom_to_project started - "
        f"file={file_path}, chat_id={chat_id}, retry={self.request.retries}"
    )

    db = None

    try:
        # Step 1: Parse Excel with AI (blocking call)
        logger.info(f"Task {task_id}: Calling parse_excel_bom")
        parse_result = parse_excel_bom.apply(args=(file_path, chat_id)).get()

        if parse_result.get('status') != 'success':
            error_msg = f"parse_excel_bom failed: {parse_result}"
            logger.error(f"Task {task_id}: {error_msg}")
            raise ValueError(error_msg)

        items = parse_result.get('items', [])
        metadata = parse_result.get('metadata', {})

        if not items:
            error_msg = "No items extracted from Excel file"
            logger.error(f"Task {task_id}: {error_msg}")
            raise ValueError(error_msg)

        logger.info(f"Task {task_id}: Extracted {len(items)} items")

        # Step 2: Database operations
        from backend.database import SessionLocal
        from backend.models import Project, ProjectItem, FailedTask
        from backend.supplier_resolver import find_or_create_supplier
        from backend.telegram_notifier import send_completion_message, send_dlq_alert

        db = SessionLocal()

        # Step 3: Resolve suppliers (auto-create if needed)
        supplier_map = {}  # Maps supplier name to supplier_id
        unique_suppliers = set(item.get('supplier') for item in items if item.get('supplier'))

        for supplier_name in unique_suppliers:
            supplier_id = find_or_create_supplier(db, supplier_name)
            if supplier_id:
                supplier_map[supplier_name] = supplier_id
                logger.info(f"Task {task_id}: Resolved supplier '{supplier_name}' -> ID {supplier_id}")
            else:
                logger.warning(f"Task {task_id}: Failed to resolve supplier '{supplier_name}'")

        # Step 4: Create Project record
        import os
        file_stem = os.path.splitext(os.path.basename(file_path))[0]
        project_name = metadata.get('project_name') or file_stem
        client = metadata.get('client') or 'Не указан'

        project = Project(
            name=project_name,
            client=client,
            status='Проектирование'
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        logger.info(
            f"Task {task_id}: Created project '{project_name}' "
            f"(ID: {project.id}, client: {client})"
        )

        # Step 5: Create ProjectItem records
        items_created = 0
        for item in items:
            supplier_name = item.get('supplier')
            supplier_id = supplier_map.get(supplier_name) if supplier_name else None

            project_item = ProjectItem(
                project_id=project.id,
                name=item.get('name'),
                sku=item.get('sku'),
                qty=item.get('qty'),
                supplier_id=supplier_id,
                status='К закупке'
            )
            db.add(project_item)
            items_created += 1

        db.commit()
        logger.info(f"Task {task_id}: Created {items_created} ProjectItem records")

        # Step 6: Send Telegram completion message
        telegram_sent = send_completion_message(
            chat_id=chat_id,
            project_name=project_name,
            items_count=items_created,
            reserved_count=0
        )

        if telegram_sent:
            logger.info(f"Task {task_id}: Telegram completion message sent")
        else:
            logger.warning(f"Task {task_id}: Failed to send Telegram completion message")

        result = {
            'status': 'success',
            'project_id': project.id,
            'items_count': items_created,
            'reserved_count': 0,
            'task_id': task_id,
        }

        logger.info(f"Task {task_id}: process_bom_to_project completed successfully")
        return result

    except RateLimitError as e:
        # Retry with exponential backoff
        retry_count = self.request.retries
        countdown = 2 ** retry_count  # 1, 2, 4...
        logger.warning(
            f"Task {task_id}: Rate limit hit, "
            f"retrying in {countdown}s (attempt {retry_count + 1}/3)"
        )
        raise self.retry(exc=e, countdown=countdown, max_retries=2)

    except Exception as e:
        # Handle error: create FailedTask, send DLQ alert
        error_message = f"{type(e).__name__}: {str(e)}\n\n{traceback.format_exc()}"

        logger.error(f"Task {task_id}: Error occurred - {error_message}")

        try:
            # Import here to avoid circular dependency
            from backend.database import SessionLocal
            from backend.models import FailedTask
            from backend.telegram_notifier import send_dlq_alert

            if db is None:
                db = SessionLocal()

            # Create FailedTask record for DLQ
            failed_task = FailedTask(
                task_id=task_id,
                task_name='tasks.process_bom_to_project',
                error_message=error_message,
                error_type=type(e).__name__,
                file_path=file_path,
                chat_id=chat_id,
                context=json.dumps({'chat_id': chat_id, 'file_path': file_path})
            )
            db.add(failed_task)
            db.commit()
            logger.info(f"Task {task_id}: FailedTask record created")

            # Send DLQ alert to owner
            send_dlq_alert(
                task_id=task_id,
                error_message=str(e),
                file_path=file_path,
                chat_id=chat_id
            )

        except Exception as inner_error:
            logger.error(
                f"Task {task_id}: Failed to create FailedTask or send alert - {inner_error}",
                exc_info=True
            )

        # Re-raise original exception for Celery DLQ handling
        raise

    finally:
        # Always close database session
        if db is not None:
            db.close()
            logger.info(f"Task {task_id}: Database session closed")


@app.task(name='tasks.parse_invoice', bind=True, max_retries=2)
def parse_invoice(self, filename: str, file_content: bytes, metadata: dict) -> dict:
    """
    Parse invoice file (PDF/Excel) and extract line items using LLM.

    This task is the entry point for invoice processing from the email worker.
    It receives the file content and metadata from an email attachment and
    processes it using the LLM provider to extract structured invoice data.

    Full implementation for S03:
    1. Parses PDF/Excel file with InvoiceParser service
    2. Extracts structured line items (sku, name, qty, unit_price, total_price)
    3. Creates Invoice record with raw_file BLOB and metadata
    4. Creates InvoiceItem records for each extracted line item
    5. Handles errors with FailedTask DLQ persistence

    Args:
        filename: Original attachment filename (e.g., 'invoice.pdf')
        file_content: Binary file content (PDF or Excel bytes)
        metadata: Email metadata dict with keys:
            - message_id: Email Message-ID
            - subject: Email subject line
            - from: Sender email address
            - date: Email date header
            - to: Recipient email address
            - uid: IMAP UID of the email

    Returns:
        dict: Result with keys:
            - status: 'success' or 'error'
            - filename: Processed filename
            - invoice_id: ID of created Invoice record
            - items_count: Number of extracted line items
            - message_id: Email Message-ID from metadata

    Raises:
        ValueError: If file format is not supported
        RateLimitError: Triggers retry with exponential backoff
    """
    task_id = self.request.id
    logger.info(
        f"Task {task_id}: parse_invoice started - "
        f"filename={filename}, size={len(file_content)}, message_id={metadata.get('message_id')}"
    )

    db = None

    try:
        # Import InvoiceParser service
        from backend.services.invoice_parser import create_invoice_parser
        from backend.database import SessionLocal
        from backend.models import Invoice, InvoiceItem, FailedTask
        from backend.supplier_resolver import find_or_create_supplier
        from decimal import Decimal

        # Step 1: Parse file with InvoiceParser
        logger.info(f"Task {task_id}: Parsing file with InvoiceParser")
        parser = create_invoice_parser()
        parse_result = parser.parse_file(filename, file_content, metadata)

        if parse_result.get('status') != 'success':
            error_msg = f"Invoice parsing failed: {parse_result.get('error')}"
            logger.error(f"Task {task_id}: {error_msg}")
            raise ValueError(error_msg)

        items = parse_result.get('items', [])
        extracted_metadata = parse_result.get('metadata', {})
        raw_text = parse_result.get('raw_text', '')

        if not items:
            error_msg = "No items extracted from invoice file"
            logger.error(f"Task {task_id}: {error_msg}")
            raise ValueError(error_msg)

        logger.info(f"Task {task_id}: Extracted {len(items)} items from invoice")

        # Step 2: Create database records
        db = SessionLocal()

        # Step 3: Find or create supplier from email metadata
        supplier_id = None
        from_email = metadata.get('from', '')
        if from_email:
            # Extract supplier name from email (before @)
            supplier_name = from_email.split('@')[0].strip()
            supplier_id = find_or_create_supplier(db, supplier_name)
            if supplier_id:
                logger.info(f"Task {task_id}: Resolved supplier '{supplier_name}' -> ID {supplier_id}")

        # Step 4: Find or create PurchaseOrder
        # For now, create a placeholder PurchaseOrder if none exists
        # In production, this would be linked to an existing PO
        from backend.models import PurchaseOrder, Project
        project_name = extracted_metadata.get('project_name') or f"Invoice-{filename}"
        client = extracted_metadata.get('client') or 'Не указан'

        # Find or create project
        project = db.query(Project).filter(Project.name == project_name).first()
        if not project:
            project = Project(name=project_name, client=client, status='Проектирование')
            db.add(project)
            db.commit()
            db.refresh(project)
            logger.info(f"Task {task_id}: Created project '{project_name}' (ID: {project.id})")

        # Find or create purchase order
        purchase_order = db.query(PurchaseOrder).filter(
            PurchaseOrder.project_id == project.id,
            PurchaseOrder.supplier_id == supplier_id if supplier_id else True
        ).first()

        if not purchase_order:
            po_status = 'Сформирован'
            purchase_order = PurchaseOrder(
                project_id=project.id,
                supplier_id=supplier_id,
                status=po_status
            )
            db.add(purchase_order)
            db.commit()
            db.refresh(purchase_order)
            logger.info(f"Task {task_id}: Created purchase order (ID: {purchase_order.id})")

        # Step 5: Create Invoice record
        invoice = Invoice(
            purchase_order_id=purchase_order.id,
            file_url=filename,
            raw_text=raw_text[:10000] if raw_text else None,  # Truncate for raw_text field
            raw_file=file_content,  # BLOB storage
            verification_result=None,  # Will be set by verification in S04
            status='Ожидает сверки'
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)

        logger.info(
            f"Task {task_id}: Created invoice record (ID: {invoice.id}) "
            f"linked to PO {purchase_order.id}"
        )

        # Step 6: Create InvoiceItem records
        items_created = 0
        for item_data in items:
            # Convert prices to Decimal
            unit_price = Decimal(str(item_data.get('unit_price', 0)))
            qty = item_data.get('qty', 1)
            total_price = Decimal(str(item_data.get('total_price', unit_price * qty)))

            invoice_item = InvoiceItem(
                invoice_id=invoice.id,
                project_item_id=None,  # Will be linked during verification in S04
                name=item_data.get('name', ''),
                sku=item_data.get('sku', ''),
                qty=qty,
                unit_price=unit_price,
                total_price=total_price
            )
            db.add(invoice_item)
            items_created += 1

        db.commit()
        logger.info(f"Task {task_id}: Created {items_created} InvoiceItem records")

        result = {
            'status': 'success',
            'filename': filename,
            'invoice_id': invoice.id,
            'items_count': items_created,
            'message_id': metadata.get('message_id'),
            'task_id': task_id,
        }

        logger.info(f"Task {task_id}: parse_invoice completed successfully")
        return result

    except RateLimitError as e:
        # Retry with exponential backoff
        retry_count = self.request.retries
        countdown = 2 ** retry_count  # 1, 2, 4...
        logger.warning(
            f"Task {task_id}: Rate limit hit, "
            f"retrying in {countdown}s (attempt {retry_count + 1}/3)"
        )
        raise self.retry(exc=e, countdown=countdown, max_retries=2)

    except Exception as e:
        # Handle error: create FailedTask for DLQ
        error_message = f"{type(e).__name__}: {str(e)}\n\n{traceback.format_exc()}"

        logger.error(f"Task {task_id}: Error occurred - {error_message}")

        try:
            from backend.database import SessionLocal
            from backend.models import FailedTask

            if db is None:
                db = SessionLocal()

            # Create FailedTask record for DLQ
            failed_task = FailedTask(
                task_id=task_id,
                task_name='tasks.parse_invoice',
                error_message=error_message,
                error_type=type(e).__name__,
                file_path=filename,
                chat_id=None,  # Email tasks don't have chat_id
                context=json.dumps({
                    'filename': filename,
                    'file_size': len(file_content),
                    'metadata': metadata
                })
            )
            db.add(failed_task)
            db.commit()
            logger.info(f"Task {task_id}: FailedTask record created")

        except Exception as inner_error:
            logger.error(
                f"Task {task_id}: Failed to create FailedTask - {inner_error}",
                exc_info=True
            )

        # Re-raise original exception for Celery DLQ handling
        raise

    finally:
        # Always close database session
        if db is not None:
            db.close()
            logger.info(f"Task {task_id}: Database session closed")


@app.task(name='tasks.verify_invoice', bind=True, max_retries=2)
def verify_invoice_task(self, invoice_id: int) -> dict:
    """
    Verify invoice items against project BOM using fuzzy matching.

    This task performs invoice-to-BOM reconciliation by:
    1. Matching invoice items to ProjectItems via exact SKU or RapidFuzz
    2. Detecting quantity discrepancies
    3. Linking InvoiceItems to ProjectItems
    4. Storing structured verification result in Invoice.verification_result JSONB
    5. Updating Invoice.status based on verification verdict
    6. Dispatching notifications based on verification verdict

    Intended to be chained after parse_invoice completes:
        parse_invoice.apply_async(args=(filename, content, metadata)) \\
            .link(verify_invoice_task.si(invoice_id))

    Args:
        invoice_id: ID of the Invoice record to verify

    Returns:
        dict: Result with keys:
            - status: 'success' or 'error'
            - invoice_id: ID of verified invoice
            - verdict: Verification verdict (verified/partial/clarification_needed/failed)
            - matched_count: Number of exact SKU matches
            - fuzzy_count: Number of fuzzy name matches
            - unmapped_count: Number of unmapped invoice items
            - discrepancies: Number of quantity discrepancies
            - extra_items: Count of extra invoice items (no BOM match)
            - missing_items: Count of missing BOM items (no invoice match)
            - task_id: Celery task ID

    Raises:
        ValueError: If invoice not found (goes to DLQ)
        Exception: Other unexpected errors (goes to DLQ)
    """
    task_id = self.request.id
    logger.info(
        f"Task {task_id}: verify_invoice started - "
        f"invoice_id={invoice_id}, retry={self.request.retries}"
    )

    db = None

    try:
        # Import invoice verifier service
        from backend.services.invoice_verifier import verify_invoice
        from backend.database import SessionLocal
        from backend.models import FailedTask, Invoice, PurchaseOrder

        # Step 1: Create database session
        db = SessionLocal()

        # Step 2: Call invoice verifier service
        logger.info(f"Task {task_id}: Calling verify_invoice service")
        verification_result = verify_invoice(invoice_id, db)

        # Step 3: Extract verification summary for result
        verdict = verification_result.verdict
        matched_count = len(verification_result.matched_items)
        fuzzy_count = len(verification_result.fuzzy_matched_items)
        unmapped_count = len(verification_result.unmapped_items)
        discrepancies = len(verification_result.quantity_discrepancies)
        extra_count = len(verification_result.extra_items)
        missing_count = len(verification_result.missing_items)

        logger.info(
            f"Task {task_id}: Verification complete - "
            f"verdict={verdict}, {matched_count} exact, {fuzzy_count} fuzzy, "
            f"{unmapped_count} unmapped, {discrepancies} discrepancies, "
            f"{extra_count} extra, {missing_count} missing"
        )

        # Step 4: Dispatch notifications based on verdict
        logger.info(f"Task {task_id}: Dispatching notifications for verdict={verdict}")
        dispatch_invoice_notifications(verification_result, invoice_id, db)

        result = {
            'status': 'success',
            'invoice_id': invoice_id,
            'verdict': verdict,
            'matched_count': matched_count,
            'fuzzy_count': fuzzy_count,
            'unmapped_count': unmapped_count,
            'discrepancies': discrepancies,
            'extra_items': extra_count,
            'missing_items': missing_count,
            'task_id': task_id,
        }

        logger.info(f"Task {task_id}: verify_invoice completed successfully")
        return result

    except ValueError as e:
        # Validation error - don't retry, goes to DLQ
        logger.error(f"Task {task_id}: Validation failed - {e}")
        raise

    except Exception as e:
        # Handle error: create FailedTask for DLQ
        error_message = f"{type(e).__name__}: {str(e)}\n\n{traceback.format_exc()}"

        logger.error(f"Task {task_id}: Error occurred - {error_message}")

        try:
            from backend.database import SessionLocal
            from backend.models import FailedTask

            if db is None:
                db = SessionLocal()

            # Create FailedTask record for DLQ
            failed_task = FailedTask(
                task_id=task_id,
                task_name='tasks.verify_invoice',
                error_message=error_message,
                error_type=type(e).__name__,
                file_path=None,
                chat_id=None,
                context=json.dumps({'invoice_id': invoice_id})
            )
            db.add(failed_task)
            db.commit()
            logger.info(f"Task {task_id}: FailedTask record created")

        except Exception as inner_error:
            logger.error(
                f"Task {task_id}: Failed to create FailedTask - {inner_error}",
                exc_info=True
            )

        # Re-raise original exception for Celery DLQ handling
        raise

    finally:
        # Always close database session
        if db is not None:
            db.close()
            logger.info(f"Task {task_id}: Database session closed")


def dispatch_invoice_notifications(verification_result, invoice_id: int, db) -> None:
    """
    Dispatch notifications based on invoice verification result.

    Routes to appropriate notification channels based on verdict:
    - 'verified' → Telegram success notification to owner
    - 'partial' → Telegram warning notification to owner
    - 'clarification_needed' → Email to supplier + Telegram notification to owner
    - 'failed' → Telegram critical alert to owner

    Notifications are non-critical: failures are logged but don't block processing.

    Args:
        verification_result: VerificationResult schema with verdict and details
        invoice_id: ID of the verified invoice
        db: SQLAlchemy database session
    """
    import os
    from backend.models import Invoice, PurchaseOrder
    from backend.telegram_notifier import (
        send_invoice_verified,
        send_invoice_partial,
        send_invoice_clarification_needed,
        send_invoice_failed,
    )
    from backend.email_notifier import send_clarification_email

    # Get owner chat_id from environment
    owner_chat_id = os.getenv('TELEGRAM_OWNER_CHAT_ID')
    if not owner_chat_id:
        logger.error('TELEGRAM_OWNER_CHAT_ID not set, skipping notifications')
        return

    try:
        owner_chat_id_int = int(owner_chat_id)
    except ValueError:
        logger.error(f'Invalid TELEGRAM_OWNER_CHAT_ID: {owner_chat_id}')
        return

    verdict = verification_result.verdict

    # Fetch Invoice and PurchaseOrder for supplier email
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        logger.warning(f"Invoice {invoice_id} not found, skipping notifications")
        return

    purchase_order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == invoice.purchase_order_id
    ).first()

    invoice_number = invoice.file_url or f"#{invoice_id}"

    if verdict == 'verified':
        # Send success notification to owner
        stats = {
            'matched': len(verification_result.matched_items),
            'total': len(verification_result.items),
            'confidence': 100.0,
        }
        try:
            send_invoice_verified(owner_chat_id_int, invoice_id, stats)
            logger.info(f"Dispatched 'verified' notification for invoice {invoice_id}")
        except Exception as e:
            logger.error(
                f"Failed to send 'verified' notification for invoice {invoice_id}: {e}",
                exc_info=True
            )

    elif verdict == 'partial':
        # Send warning notification about discrepancies
        discrepancies = []
        for disc in verification_result.quantity_discrepancies:
            discrepancies.append(
                f"Item {disc.invoice_item_id}: invoice={disc.invoice_qty}, "
                f"expected={disc.expected_qty}"
            )
        try:
            send_invoice_partial(owner_chat_id_int, invoice_id, discrepancies)
            logger.info(f"Dispatched 'partial' notification for invoice {invoice_id}")
        except Exception as e:
            logger.error(
                f"Failed to send 'partial' notification for invoice {invoice_id}: {e}",
                exc_info=True
            )

    elif verdict == 'clarification_needed':
        # Send email to supplier + notification to owner
        supplier_email = None
        supplier_name = None

        if purchase_order and purchase_order.supplier:
            supplier_email = purchase_order.supplier.email
            supplier_name = purchase_order.supplier.name

        if supplier_email:
            # Build unmatched items for email
            from backend.models import InvoiceItem, ProjectItem
            unmatched_items = []
            for item in verification_result.fuzzy_matched_items:
                # Fetch invoice item details
                invoice_item = db.query(InvoiceItem).filter(
                    InvoiceItem.id == item.invoice_item_id
                ).first()
                if invoice_item:
                    # Fetch expected project item
                    project_item = db.query(ProjectItem).filter(
                        ProjectItem.id == item.project_item_id
                    ).first()

                    unmatched_items.append({
                        'invoice_item': {
                            'name': invoice_item.name,
                            'quantity': invoice_item.qty,
                            'price': float(invoice_item.unit_price) if invoice_item.unit_price else None,
                        },
                        'expected_item': {
                            'name': project_item.name if project_item else 'N/A',
                        },
                        'confidence': item.name_similarity / 100.0 if item.name_similarity else 0.0,
                    })

            # Send email asynchronously (fire and forget in task context)
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                loop.run_until_complete(
                    send_clarification_email(
                        supplier_email=supplier_email,
                        invoice_number=invoice_number,
                        supplier_name=supplier_name,
                        unmatched_items=unmatched_items
                    )
                )
                logger.info(
                    f"Sent clarification email to supplier {supplier_email} "
                    f"for invoice {invoice_id}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to send clarification email: {e}",
                    exc_info=True
                )

        # Also notify owner via Telegram
        fuzzy_matches = []
        for item in verification_result.fuzzy_matched_items:
            fuzzy_matches.append({
                'name': f"Item {item.invoice_item_id}",
                'confidence': item.name_similarity / 100.0 if item.name_similarity else 0.0,
            })

        try:
            send_invoice_clarification_needed(owner_chat_id_int, invoice_id, fuzzy_matches)
            logger.info(f"Dispatched 'clarification_needed' notification for invoice {invoice_id}")
        except Exception as e:
            logger.error(
                f"Failed to send 'clarification_needed' notification for invoice {invoice_id}: {e}",
                exc_info=True
            )

    elif verdict == 'failed':
        # Send critical alert to owner
        error_msg = (
            f"Invoice verification failed. "
            f"{len(verification_result.unmapped_items)} items could not be matched."
        )
        try:
            send_invoice_failed(owner_chat_id_int, invoice_id, error_msg)
            logger.info(f"Dispatched 'failed' notification for invoice {invoice_id}")
        except Exception as e:
            logger.error(
                f"Failed to send 'failed' notification for invoice {invoice_id}: {e}",
                exc_info=True
            )

    else:
        logger.warning(f"Unknown verdict '{verdict}', skipping notifications")
