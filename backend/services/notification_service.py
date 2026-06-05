"""
Notification service — dispatches notifications based on invoice verification results.

Extracted from tasks.py dispatch_invoice_notifications and refactored to
properly handle async email sending without fragile asyncio.get_event_loop()
workarounds.
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional

from sqlalchemy.orm import Session

from backend.models import Invoice, InvoiceItem, PurchaseOrder, ProjectItem

logger = logging.getLogger(__name__)


def dispatch_invoice_notifications(verification_result, invoice_id: int, db: Session) -> None:
    """
    Dispatch notifications based on invoice verification result.

    Routes to appropriate notification channels based on verdict:
    - 'verified' → Telegram success notification to owner
    - 'partial' → Telegram warning notification to owner
    - 'clarification_needed' → Email to supplier + Telegram notification to owner
    - 'failed' → Telegram critical alert to owner

    All notification failures are logged but never block the calling task.
    """
    owner_chat_id = os.getenv('TELEGRAM_OWNER_CHAT_ID')
    if not owner_chat_id:
        logger.error('TELEGRAM_OWNER_CHAT_ID not set, skipping notifications')
        return

    try:
        owner_chat_id_int = int(owner_chat_id)
    except ValueError:
        logger.error('Invalid TELEGRAM_OWNER_CHAT_ID: %s', owner_chat_id)
        return

    verdict = verification_result.verdict

    # Fetch Invoice and PurchaseOrder for context
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        logger.warning("Invoice %d not found, skipping notifications", invoice_id)
        return

    purchase_order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == invoice.purchase_order_id
    ).first()

    invoice_number = invoice.file_url or f"#{invoice_id}"

    dispatchers = {
        'verified': _dispatch_verified,
        'partial': _dispatch_partial,
        'clarification_needed': _dispatch_clarification_needed,
        'failed': _dispatch_failed,
    }

    handler = dispatchers.get(verdict)
    if handler:
        try:
            handler(
                owner_chat_id_int=owner_chat_id_int,
                invoice_id=invoice_id,
                invoice_number=invoice_number,
                verification_result=verification_result,
                purchase_order=purchase_order,
                db=db,
            )
        except Exception as e:
            logger.error(
                "Failed to dispatch '%s' notification for invoice %d: %s",
                verdict, invoice_id, e, exc_info=True,
            )
    else:
        logger.warning("Unknown verdict '%s', skipping notifications", verdict)


# ---------------------------------------------------------------------------
# Individual notification dispatchers (private)
# ---------------------------------------------------------------------------

def _dispatch_verified(
    *,
    owner_chat_id_int: int,
    invoice_id: int,
    invoice_number: str,
    verification_result,
    purchase_order: Optional[PurchaseOrder],
    db: Session,
) -> None:
    """Send success notification to owner."""
    from backend.telegram_notifier import send_invoice_verified

    stats = {
        'matched': len(verification_result.matched_items),
        'total': len(verification_result.items),
        'confidence': 100.0,
    }
    send_invoice_verified(owner_chat_id_int, invoice_id, stats)
    logger.info("Dispatched 'verified' notification for invoice %d", invoice_id)


def _dispatch_partial(
    *,
    owner_chat_id_int: int,
    invoice_id: int,
    invoice_number: str,
    verification_result,
    purchase_order: Optional[PurchaseOrder],
    db: Session,
) -> None:
    """Send warning notification about discrepancies."""
    from backend.telegram_notifier import send_invoice_partial

    discrepancies = []
    for disc in verification_result.quantity_discrepancies:
        discrepancies.append(
            f"Item {disc.invoice_item_id}: invoice={disc.invoice_qty}, "
            f"expected={disc.expected_qty}"
        )
    send_invoice_partial(owner_chat_id_int, invoice_id, discrepancies)
    logger.info("Dispatched 'partial' notification for invoice %d", invoice_id)


def _dispatch_clarification_needed(
    *,
    owner_chat_id_int: int,
    invoice_id: int,
    invoice_number: str,
    verification_result,
    purchase_order: Optional[PurchaseOrder],
    db: Session,
) -> None:
    """Send email to supplier + notification to owner."""
    from backend.telegram_notifier import send_invoice_clarification_needed
    from backend.email_notifier import send_clarification_email

    # Send email to supplier if available
    supplier_email = None
    supplier_name = None

    if purchase_order and purchase_order.supplier:
        supplier_email = purchase_order.supplier.email
        supplier_name = purchase_order.supplier.name

    if supplier_email:
        unmatched_items = _build_unmatched_items(verification_result, db)
        _send_supplier_email_sync(
            supplier_email=supplier_email,
            supplier_name=supplier_name,
            invoice_number=invoice_number,
            unmatched_items=unmatched_items,
        )

    # Notify owner via Telegram
    fuzzy_matches = [
        {
            'name': f"Item {item.invoice_item_id}",
            'confidence': item.name_similarity / 100.0 if item.name_similarity else 0.0,
        }
        for item in verification_result.fuzzy_matched_items
    ]

    send_invoice_clarification_needed(owner_chat_id_int, invoice_id, fuzzy_matches)
    logger.info("Dispatched 'clarification_needed' notification for invoice %d", invoice_id)


def _dispatch_failed(
    *,
    owner_chat_id_int: int,
    invoice_id: int,
    invoice_number: str,
    verification_result,
    purchase_order: Optional[PurchaseOrder],
    db: Session,
) -> None:
    """Send critical alert to owner."""
    from backend.telegram_notifier import send_invoice_failed

    error_msg = (
        f"Invoice verification failed. "
        f"{len(verification_result.unmapped_items)} items could not be matched."
    )
    send_invoice_failed(owner_chat_id_int, invoice_id, error_msg)
    logger.info("Dispatched 'failed' notification for invoice %d", invoice_id)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_unmatched_items(verification_result, db: Session) -> List[dict]:
    """Build list of unmatched items for clarification email."""
    unmatched_items = []
    for item in verification_result.fuzzy_matched_items:
        invoice_item = db.query(InvoiceItem).filter(
            InvoiceItem.id == item.invoice_item_id
        ).first()
        if invoice_item:
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
    return unmatched_items


def _send_supplier_email_sync(
    *,
    supplier_email: str,
    supplier_name: Optional[str],
    invoice_number: str,
    unmatched_items: List[dict],
) -> None:
    """
    Send clarification email to supplier.

    Uses a dedicated async approach instead of the fragile
    asyncio.get_event_loop().run_until_complete() pattern that was
    previously used inside a Celery worker.
    """
    import asyncio
    from backend.email_notifier import send_clarification_email

    async def _do_send():
        await send_clarification_email(
            supplier_email=supplier_email,
            invoice_number=invoice_number,
            supplier_name=supplier_name,
            unmatched_items=unmatched_items,
        )

    try:
        # Create a NEW event loop (safe in Celery worker context)
        # instead of trying to reuse an existing one
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_do_send())
        finally:
            loop.close()
        logger.info(
            "Sent clarification email to supplier %s for invoice %s",
            supplier_email, invoice_number,
        )
    except Exception as e:
        logger.error("Failed to send clarification email: %s", e, exc_info=True)
