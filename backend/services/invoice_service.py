"""
Invoice service — business logic for processing invoices from email attachments.

Extracted from tasks.py parse_invoice to follow Clean Architecture:
the task is now a thin orchestrator, and all domain logic lives here.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Tuple

from sqlalchemy.orm import Session

from backend.models import Invoice, InvoiceItem, PurchaseOrder, Project

logger = logging.getLogger(__name__)


def process_invoice_from_email(
    db: Session,
    filename: str,
    file_content: bytes,
    metadata: dict,
) -> Tuple[Invoice, int]:
    """
    Process an invoice file received via email.

    This is the core domain operation that was previously embedded in
    the Celery task.  It handles:

    1. Parsing the file with InvoiceParser service
    2. Resolving/creating supplier from email metadata
    3. Finding or creating Project and PurchaseOrder
    4. Creating Invoice record with raw_file BLOB
    5. Creating InvoiceItem records for each extracted line item

    Args:
        db: Active SQLAlchemy session (caller manages lifecycle).
        filename: Original attachment filename (e.g., 'invoice.pdf').
        file_content: Binary file content (PDF or Excel bytes).
        metadata: Email metadata dict with keys: message_id, subject, from, date, to, uid.

    Returns:
        Tuple of (Invoice, items_created_count).
    """
    from backend.services.invoice_parser import create_invoice_parser
    from backend.supplier_resolver import find_or_create_supplier

    # Step 1: Parse file with InvoiceParser
    logger.info("Parsing file with InvoiceParser")
    parser = create_invoice_parser()
    parse_result = parser.parse_file(filename, file_content, metadata)

    if parse_result.get('status') != 'success':
        raise ValueError(f"Invoice parsing failed: {parse_result.get('error')}")

    items = parse_result.get('items', [])
    extracted_metadata = parse_result.get('metadata', {})
    raw_text = parse_result.get('raw_text', '')

    if not items:
        raise ValueError("No items extracted from invoice file")

    logger.info("Extracted %d items from invoice", len(items))

    # Step 2: Find or create supplier from email metadata
    supplier_id = None
    from_email = metadata.get('from', '')
    if from_email:
        supplier_name = from_email.split('@')[0].strip()
        supplier_id = find_or_create_supplier(db, supplier_name)
        if supplier_id:
            logger.info("Resolved supplier '%s' -> ID %d", supplier_name, supplier_id)

    # Step 3: Find or create Project and PurchaseOrder
    project_name = extracted_metadata.get('project_name') or f"Invoice-{filename}"
    client = extracted_metadata.get('client') or 'Не указан'

    project = db.query(Project).filter(Project.name == project_name).first()
    if not project:
        project = Project(name=project_name, client=client, status='Проектирование')
        db.add(project)
        db.commit()
        db.refresh(project)
        logger.info("Created project '%s' (ID: %d)", project_name, project.id)

    purchase_order = db.query(PurchaseOrder).filter(
        PurchaseOrder.project_id == project.id,
        PurchaseOrder.supplier_id == supplier_id if supplier_id else True,
    ).first()

    if not purchase_order:
        purchase_order = PurchaseOrder(
            project_id=project.id,
            supplier_id=supplier_id,
            status='Сформирован',
        )
        db.add(purchase_order)
        db.commit()
        db.refresh(purchase_order)
        logger.info("Created purchase order (ID: %d)", purchase_order.id)

    # Step 4: Create Invoice record
    invoice = Invoice(
        purchase_order_id=purchase_order.id,
        file_url=filename,
        raw_text=raw_text[:10000] if raw_text else None,
        raw_file=file_content,
        verification_result=None,
        status='Ожидает сверки',
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    logger.info(
        "Created invoice record (ID: %d) linked to PO %d",
        invoice.id, purchase_order.id,
    )

    # Step 5: Create InvoiceItem records
    items_created = 0
    for item_data in items:
        unit_price = Decimal(str(item_data.get('unit_price', 0)))
        qty = item_data.get('qty', 1)
        total_price = Decimal(str(item_data.get('total_price', unit_price * qty)))

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            project_item_id=None,
            name=item_data.get('name', ''),
            sku=item_data.get('sku', ''),
            qty=qty,
            unit_price=unit_price,
            total_price=total_price,
        )
        db.add(invoice_item)
        items_created += 1

    db.commit()
    logger.info("Created %d InvoiceItem records", items_created)

    return invoice, items_created
