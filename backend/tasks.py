"""
Celery tasks for ZakupPro.

This module contains all background task definitions. Tasks use BaseTask
from backend.services.task_base which provides automatic DLQ persistence,
DB session lifecycle, and retry logic — so each task only implements
its business logic in execute().
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from backend.celery_app import app
from backend.services.task_base import BaseTask

logger = logging.getLogger(__name__)


# =============================================================================
# Health-check / Demo tasks
# =============================================================================

@app.task(name='tasks.dummy_health_check', bind=True)
def dummy_health_check(self):
    """Dummy health check task for testing Celery worker connectivity."""
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
    """Example task: add two numbers."""
    logger.info(f"Task {self.request.id}: Adding {x} + {y}")
    result = x + y
    logger.info(f"Task {self.request.id}: Result = {result}")
    return result


@app.task(name='tasks.failing_task', bind=True, max_retries=3)
def failing_task(self, should_fail=True):
    """Example task that demonstrates retry behavior and DLQ."""
    logger.info(f"Task {self.request.id} executing (retry {self.request.retries})")
    if should_fail:
        error_msg = "Task failed as requested"
        logger.warning(f"Task {self.request.id}: {error_msg}")
        raise ValueError(error_msg)
    return {'status': 'success', 'message': 'Task completed successfully'}


# =============================================================================
# Excel BOM Processing Tasks
# =============================================================================

class _QueueExcelProcessingTask(BaseTask):
    """Queue Excel file for asynchronous processing."""

    task_name = 'tasks.queue_excel_processing'

    def execute(self, db, *, file_path: str, chat_id: int, **kwargs) -> dict:
        logger.info("Processing Excel file: %s from chat_id=%s", file_path, chat_id)

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        if not file_path.lower().endswith(('.xlsx', '.xls')):
            raise ValueError(f"Invalid file extension: {file_path}")

        file_size = os.path.getsize(file_path)
        logger.info(
            "File validated — path=%s, size=%d bytes, chat_id=%s",
            file_path, file_size, chat_id,
        )

        return {
            'status': 'queued',
            'task_id': self.request.id,
            'file_path': file_path,
            'file_size': file_size,
            'chat_id': chat_id,
            'message': 'Excel file queued for processing',
        }


@app.task(name='tasks.queue_excel_processing', bind=True, base=_QueueExcelProcessingTask)
def queue_excel_processing(self, file_path: str, chat_id: int) -> dict:
    return self.run_with_context(file_path=file_path, chat_id=chat_id)


class _ParseExcelBomTask(BaseTask):
    """Parse Excel file and extract BOM structure using GPT-4o."""

    task_name = 'tasks.parse_excel_bom'

    def execute(self, db, *, file_path: str, chat_id: int, **kwargs) -> dict:
        from backend.excel_parser import read_excel_file, clean_dataframe, dataframe_to_markdown
        from backend.ai_agent import extract_bom_structure, ExtractedBOM

        logger.info("Reading Excel file")
        df = read_excel_file(file_path)
        logger.info("Excel read successful, %d rows", len(df))

        logger.info("Cleaning dataframe")
        df_clean = clean_dataframe(df)
        logger.info("Dataframe cleaned, %d data rows", len(df_clean))

        logger.info("Converting to markdown")
        markdown = dataframe_to_markdown(df_clean)
        logger.info("Markdown generated (%d chars)", len(markdown))

        logger.info("Calling GPT-4o for BOM extraction")
        extracted = extract_bom_structure(markdown)

        validated = ExtractedBOM.model_validate(extracted)
        logger.info("Validation passed — %d items extracted", len(validated.items))

        return {
            'status': 'success',
            'items_count': len(validated.items),
            'items': [item.model_dump() for item in validated.items],
            'metadata': validated.metadata.model_dump() if validated.metadata else {},
            'task_id': self.request.id,
        }


@app.task(name='tasks.parse_excel_bom', bind=True, base=_ParseExcelBomTask, max_retries=2)
def parse_excel_bom(self, file_path: str, chat_id: int) -> dict:
    return self.run_with_context(file_path=file_path, chat_id=chat_id)


# =============================================================================
# BOM → Project Orchestration Task
# =============================================================================

class _ProcessBomToProjectTask(BaseTask):
    """Main orchestration task for BOM to Project workflow."""

    task_name = 'tasks.process_bom_to_project'

    def execute(self, db, *, file_path: str, chat_id: int, **kwargs) -> dict:
        from backend.models import Project, ProjectItem
        from backend.services.project_service import create_project_from_bom

        # Step 1: Parse Excel with AI (blocking call)
        logger.info("Calling parse_excel_bom")
        parse_result = parse_excel_bom.apply(args=(file_path, chat_id)).get()

        if parse_result.get('status') != 'success':
            raise ValueError(f"parse_excel_bom failed: {parse_result}")

        items = parse_result.get('items', [])
        metadata = parse_result.get('metadata', {})

        if not items:
            raise ValueError("No items extracted from Excel file")

        logger.info("Extracted %d items", len(items))

        # Step 2–5: Delegate to service layer
        project, items_created, reserved_count = create_project_from_bom(
            db=db,
            items=items,
            metadata=metadata,
            file_path=file_path,
        )

        # Step 6: Send Telegram completion message
        from backend.telegram_notifier import send_completion_message

        project_name = project.name
        telegram_sent = send_completion_message(
            chat_id=chat_id,
            project_name=project_name,
            items_count=items_created,
            reserved_count=reserved_count,
        )

        if telegram_sent:
            logger.info("Telegram completion message sent")
        else:
            logger.warning("Failed to send Telegram completion message")

        return {
            'status': 'success',
            'project_id': project.id,
            'items_count': items_created,
            'reserved_count': reserved_count,
            'task_id': self.request.id,
        }


@app.task(name='tasks.process_bom_to_project', bind=True, base=_ProcessBomToProjectTask, max_retries=2)
def process_bom_to_project(self, file_path: str, chat_id: int) -> dict:
    return self.run_with_context(file_path=file_path, chat_id=chat_id)


# =============================================================================
# Invoice Processing Tasks
# =============================================================================

class _ParseInvoiceTask(BaseTask):
    """Parse invoice file (PDF/Excel) and extract line items using LLM."""

    task_name = 'tasks.parse_invoice'

    def get_dlq_file_path(self, **kwargs) -> Optional[str]:
        return kwargs.get('filename')

    def get_dlq_chat_id(self, **kwargs) -> Optional[int]:
        return None  # Email tasks don't have chat_id

    def get_dlq_context(self, **kwargs) -> dict:
        return {
            'filename': kwargs.get('filename'),
            'file_size': len(kwargs['file_content']) if 'file_content' in kwargs else 0,
            'metadata': kwargs.get('metadata', {}),
        }

    def execute(self, db, *, filename: str, file_content: bytes, metadata: dict, **kwargs) -> dict:
        from backend.services.invoice_service import process_invoice_from_email

        invoice, items_created = process_invoice_from_email(
            db=db,
            filename=filename,
            file_content=file_content,
            metadata=metadata,
        )

        return {
            'status': 'success',
            'filename': filename,
            'invoice_id': invoice.id,
            'items_count': items_created,
            'message_id': metadata.get('message_id'),
            'task_id': self.request.id,
        }


@app.task(name='tasks.parse_invoice', bind=True, base=_ParseInvoiceTask, max_retries=2)
def parse_invoice(self, filename: str, file_content: bytes, metadata: dict) -> dict:
    return self.run_with_context(filename=filename, file_content=file_content, metadata=metadata)


class _VerifyInvoiceTask(BaseTask):
    """Verify invoice items against project BOM using fuzzy matching."""

    task_name = 'tasks.verify_invoice'

    def get_dlq_context(self, **kwargs) -> dict:
        return {'invoice_id': kwargs.get('invoice_id')}

    def execute(self, db, *, invoice_id: int, **kwargs) -> dict:
        from backend.services.invoice_verifier import verify_invoice
        from backend.services.notification_service import dispatch_invoice_notifications

        logger.info("Calling verify_invoice service")
        verification_result = verify_invoice(invoice_id, db)

        # Dispatch notifications based on verdict
        logger.info("Dispatching notifications for verdict=%s", verification_result.verdict)
        dispatch_invoice_notifications(verification_result, invoice_id, db)

        return {
            'status': 'success',
            'invoice_id': invoice_id,
            'verdict': verification_result.verdict,
            'matched_count': len(verification_result.matched_items),
            'fuzzy_count': len(verification_result.fuzzy_matched_items),
            'unmapped_count': len(verification_result.unmapped_items),
            'discrepancies': len(verification_result.quantity_discrepancies),
            'extra_items': len(verification_result.extra_items),
            'missing_items': len(verification_result.missing_items),
            'task_id': self.request.id,
        }


@app.task(name='tasks.verify_invoice', bind=True, base=_VerifyInvoiceTask, max_retries=2)
def verify_invoice_task(self, invoice_id: int) -> dict:
    return self.run_with_context(invoice_id=invoice_id)


# =============================================================================
# Bank Statement Processing Tasks
# =============================================================================

class _ParseBankStatementTask(BaseTask):
    """Parse 1C ClientBank .txt file and persist to BankStatement/BankTransaction tables."""

    task_name = 'tasks.parse_bank_statement'

    def get_dlq_file_path(self, **kwargs) -> Optional[str]:
        return kwargs.get('filename')

    def get_dlq_context(self, **kwargs) -> dict:
        return {
            'filename': kwargs.get('filename'),
            'file_size': len(kwargs['file_content']) if 'file_content' in kwargs else 0,
            'metadata': kwargs.get('metadata', {}),
        }

    def execute(self, db, *, filename: str, file_content: bytes, metadata: dict, **kwargs) -> dict:
        from backend.services.bank_statement_parser import parse_bank_statement_file
        from backend.models import BankStatement, BankTransaction

        logger.info("Parsing file with BankStatementParser")
        parse_result = parse_bank_statement_file(file_content)

        bank_name = parse_result.get('bank_name', 'Unknown')
        statement_date = parse_result.get('statement_date')
        period_start = parse_result.get('period_start')
        period_end = parse_result.get('period_end')
        transactions = parse_result.get('transactions', [])

        if not transactions:
            raise ValueError(f"No transactions found in bank statement file {filename}")

        logger.info(
            "Parsed %d transactions from %s, period %s to %s",
            len(transactions), bank_name, period_start, period_end,
        )

        # Create BankStatement record
        bank_statement = BankStatement(
            bank_name=bank_name,
            statement_date=statement_date,
            period_start=period_start,
            period_end=period_end,
            raw_file=file_content,
            status='Обрабатывается',
        )
        db.add(bank_statement)
        db.commit()
        db.refresh(bank_statement)

        logger.info("Created BankStatement record (ID: %d)", bank_statement.id)

        # Create BankTransaction records
        transactions_created = 0
        for txn_data in transactions:
            transaction = BankTransaction(
                bank_statement_id=bank_statement.id,
                transaction_date=txn_data.get('transaction_date'),
                amount=txn_data.get('amount'),
                supplier_inn=txn_data.get('supplier_inn'),
                description=txn_data.get('description'),
                operation_type=txn_data.get('operation_type', 'Debit'),
            )
            db.add(transaction)
            transactions_created += 1

        db.commit()
        logger.info("Created %d BankTransaction records", transactions_created)

        # Update status to ready
        bank_statement.status = 'Готов'
        db.commit()

        return {
            'status': 'success',
            'filename': filename,
            'bank_statement_id': bank_statement.id,
            'transactions_count': transactions_created,
            'bank_name': bank_name,
            'period_start': period_start.isoformat() if period_start else None,
            'period_end': period_end.isoformat() if period_end else None,
            'message_id': metadata.get('message_id'),
            'task_id': self.request.id,
        }


@app.task(name='tasks.parse_bank_statement', bind=True, base=_ParseBankStatementTask, max_retries=2)
def parse_bank_statement(self, filename: str, file_content: bytes, metadata: dict) -> dict:
    return self.run_with_context(filename=filename, file_content=file_content, metadata=metadata)


class _MatchBankTransactionsTask(BaseTask):
    """Match bank transactions to invoices using PaymentMatcher service."""

    task_name = 'tasks.match_bank_transactions'

    def get_dlq_context(self, **kwargs) -> dict:
        return {
            'bank_statement_id': kwargs.get('bank_statement_id'),
            'bank_transaction_id': kwargs.get('bank_transaction_id'),
        }

    def execute(self, db, *, bank_statement_id: Optional[int] = None, bank_transaction_id: Optional[int] = None, **kwargs) -> dict:
        from backend.services.payment_matcher import PaymentMatcher

        # Validate inputs
        if bank_statement_id is None and bank_transaction_id is None:
            raise ValueError("Either bank_statement_id or bank_transaction_id must be provided")
        if bank_statement_id is not None and bank_transaction_id is not None:
            raise ValueError("bank_statement_id and bank_transaction_id are mutually exclusive")

        matcher = PaymentMatcher(db)

        if bank_statement_id is not None:
            logger.info("Matching transactions for bank_statement_id=%d", bank_statement_id)
            match_result = matcher.match_statement_transactions(bank_statement_id)
        else:
            logger.info("Matching transaction bank_transaction_id=%d", bank_transaction_id)
            match_result = matcher.match_transaction(bank_transaction_id)

        logger.info(
            "Matching complete — %d matched, %d unresolved, %d payments, %d errors",
            match_result.matched_count, match_result.unresolved_count,
            len(match_result.payment_ids), len(match_result.errors),
        )

        return {
            'status': 'success',
            'matched_count': match_result.matched_count,
            'unresolved_count': match_result.unresolved_count,
            'payment_ids': match_result.payment_ids,
            'errors': match_result.errors,
            'task_id': self.request.id,
        }


@app.task(name='tasks.match_bank_transactions', bind=True, base=_MatchBankTransactionsTask, max_retries=2)
def match_bank_transactions(self, bank_statement_id: Optional[int] = None, bank_transaction_id: Optional[int] = None) -> dict:
    return self.run_with_context(bank_statement_id=bank_statement_id, bank_transaction_id=bank_transaction_id)


# =============================================================================
# Scheduled Tasks
# =============================================================================

class _SendDelayDigestTask(BaseTask):
    """Daily 9:00 AM digest of all production task delays."""

    task_name = 'tasks.send_delay_digest'

    def execute(self, db, **kwargs) -> dict:
        from datetime import datetime
        from backend.models import ProductionTask, Project

        logger.info("Starting delay digest")

        now = datetime.utcnow()

        # Query delayed tasks
        delayed_tasks = db.query(ProductionTask).join(Project).filter(
            db.or_(
                db.and_(
                    ProductionTask.expected_completion_date.isnot(None),
                    ProductionTask.expected_completion_date < now,
                ),
                ProductionTask.delay_reason.isnot(None),
            )
        ).all()

        logger.info("Found %d delayed tasks", len(delayed_tasks))

        # Group by delay reason
        summary_by_reason: dict[str, list] = {}
        delay_details = []

        for task in delayed_tasks:
            reason_key = task.delay_reason.value if task.delay_reason else "not_recorded"
            if reason_key not in summary_by_reason:
                summary_by_reason[reason_key] = []

            is_late = (
                task.expected_completion_date is not None
                and task.expected_completion_date < now
            )

            delay_info = {
                'task_id': task.id,
                'project_id': task.project_id,
                'project_name': task.project.name if task.project else 'Unknown',
                'status': task.status,
                'expected_completion_date': task.expected_completion_date.isoformat() if task.expected_completion_date else None,
                'delay_reason': reason_key,
                'custom_reason': task.custom_reason,
                'is_late': is_late,
            }
            summary_by_reason[reason_key].append(delay_info)
            delay_details.append(delay_info)

        # Build digest message
        digest_lines = [
            f"=== Ежедневный дайджест задержек производства ===",
            f"Дата: {now.strftime('%Y-%m-%d %H:%M')}",
            f"Всего задач с задержками: {len(delayed_tasks)}",
            "",
        ]

        reason_labels = {
            'waiting_materials': 'Ожидание материалов',
            'equipment_failure': 'Поломка оборудования',
            'staff_shortage': 'Нехватка персонала',
            'supplier_delay': 'Задержка поставщика',
            'technical_issues': 'Технические проблемы',
            'other': 'Другое',
            'not_recorded': 'Причина не указана',
        }

        for reason, tasks in summary_by_reason.items():
            reason_label = reason_labels.get(reason, reason)
            digest_lines.append(f"— {reason_label}: {len(tasks)} задач")

            for t in tasks[:3]:
                late_mark = " (ПРОСРОЧЕНО)" if t['is_late'] else ""
                digest_lines.append(f"  • Проект: {t['project_name']}, Статус: {t['status']}{late_mark}")
                if t['custom_reason']:
                    digest_lines.append(f"    Примечание: {t['custom_reason']}")
            if len(tasks) > 3:
                digest_lines.append(f"  ... и еще {len(tasks) - 3} задач")
            digest_lines.append("")

        digest_message = "\n".join(digest_lines)
        logger.info("Delay digest generated:\n%s", digest_message)

        return {
            'status': 'success',
            'total_delayed': len(delayed_tasks),
            'summary_by_reason': {k: len(v) for k, v in summary_by_reason.items()},
            'digest_message': digest_message,
            'task_id': self.request.id,
        }


@app.task(name='tasks.send_delay_digest', bind=True, base=_SendDelayDigestTask)
def send_delay_digest(self) -> dict:
    return self.run_with_context()
