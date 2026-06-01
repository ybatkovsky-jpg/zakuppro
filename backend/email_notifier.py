"""
Email Notification Helper for Celery tasks.

Provides async SMTP functionality for sending clarification emails to suppliers:
- send_clarification_email: Requests supplier confirmation for fuzzy-matched items

Uses aiosmtplib for async SMTP with environment configuration.
Follows non-critical pattern: returns bool, logs errors, doesn't block processing.
"""

import os
import logging
from typing import Optional, List, Dict, Any
from email.message import EmailMessage

logger = logging.getLogger(__name__)

# Optional import guard for aiosmtplib availability
try:
    import aiosmtplib
    SMTP_AVAILABLE = True
except ImportError:
    logger.warning(
        'aiosmtplib not available. '
        'Email notifications will be disabled.'
    )
    SMTP_AVAILABLE = False
    aiosmtplib = None  # type: ignore


# Environment variables
SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_EMAIL = os.getenv('SMTP_EMAIL')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'ZakupPro')


def _check_smtp_config() -> bool:
    """
    Check if SMTP configuration is complete.

    Returns:
        bool: True if all required env vars are set
    """
    if not SMTP_AVAILABLE:
        logger.error('aiosmtplib library not available')
        return False

    missing = []
    if not SMTP_HOST:
        missing.append('SMTP_HOST')
    if not SMTP_EMAIL:
        missing.append('SMTP_EMAIL')
    if not SMTP_PASSWORD:
        missing.append('SMTP_PASSWORD')

    if missing:
        logger.error(
            f'SMTP configuration incomplete. Missing: {", ".join(missing)}'
        )
        return False

    return True


def _build_clarification_email(
    supplier_email: str,
    supplier_name: str,
    invoice_number: str,
    unmatched_items: List[Dict[str, Any]]
) -> EmailMessage:
    """
    Build clarification email message in Russian.

    Email format (Russian):
        Subject: Запрос уточнения по счету {invoice_number}
        Body:
            Уважаемый партнер,
            По счету {invoice_number} обнаружены расхождения.
            Просим подтвердить соответствие позиций.

    Args:
        supplier_email: Supplier's email address
        supplier_name: Supplier's name for greeting
        invoice_number: Invoice number for reference
        unmatched_items: List of fuzzy-matched items with invoice/expected values

    Returns:
        EmailMessage: Formatted email message
    """
    msg = EmailMessage()
    msg['From'] = f'{SMTP_FROM_NAME} <{SMTP_EMAIL}>'
    msg['To'] = supplier_email
    msg['Subject'] = f'Запрос уточнения по счету {invoice_number}'

    # Build email body in Russian
    body_lines = [
        f'Уважаемый {supplier_name or "партнер"}!',
        '',
        f'По счету №{invoice_number} обнаружены позиции, требующие уточнения.',
        'Просим подтвердить соответствие следующих товаров:',
        '',
    ]

    # Add unmatched items table
    for idx, item in enumerate(unmatched_items[:10], 1):
        invoice_item = item.get('invoice_item', {})
        expected_item = item.get('expected_item', {})
        confidence = item.get('confidence', 0)

        body_lines.append(f'{idx}. Позиция из счета:')
        body_lines.append(f'   Наименование: {invoice_item.get("name", "N/A")}')

        if invoice_item.get('quantity'):
            body_lines.append(f'   Количество: {invoice_item["quantity"]}')

        if invoice_item.get('price'):
            body_lines.append(f'   Цена: {invoice_item["price"]} руб.')

        body_lines.append(f'   Возможное соответствие: {expected_item.get("name", "N/A")}')
        body_lines.append(f'   Точность совпадения: {confidence:.0%}')
        body_lines.append('')

    if len(unmatched_items) > 10:
        body_lines.append(f'... и еще {len(unmatched_items) - 10} позиций.')
        body_lines.append('')

    body_lines.extend([
        'Пожалуйста, подтвердите, что данные позиции соответствуют вашему прайсу-листу,',
        'или сообщите правильные наименования.',
        '',
        'С уважением,',
        f'{SMTP_FROM_NAME}'
    ])

    msg.set_content('\n'.join(body_lines))
    return msg


async def send_clarification_email(
    supplier_email: str,
    invoice_number: str,
    supplier_name: Optional[str] = None,
    unmatched_items: Optional[List[Dict[str, Any]]] = None
) -> bool:
    """
    Send clarification email to supplier for fuzzy-matched invoice items.

    Async function using aiosmtplib for non-blocking SMTP operation.

    Email includes:
    - Supplier greeting (name if provided)
    - Invoice number for reference
    - List of fuzzy-matched items (invoice vs expected)
    - Request for confirmation

    Args:
        supplier_email: Supplier's email address
        invoice_number: Invoice number requiring clarification
        supplier_name: Optional supplier name for personalized greeting
        unmatched_items: List of fuzzy match candidates with:
            - invoice_item: Dict with name, quantity, price from invoice
            - expected_item: Dict with name from BOM/supplier catalog
            - confidence: Float match confidence score

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not _check_smtp_config():
        return False

    if unmatched_items is None:
        unmatched_items = []

    try:
        # Build email message
        msg = _build_clarification_email(
            supplier_email=supplier_email,
            supplier_name=supplier_name or '',
            invoice_number=invoice_number,
            unmatched_items=unmatched_items
        )

        # Connect to SMTP server and send
        smtp_client = aiosmtplib.SMTP(
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            use_tls=True,
        )

        async with smtp_client:
            await smtp_client.login(SMTP_EMAIL, SMTP_PASSWORD)
            await smtp_client.send_message(msg)

        logger.info(
            f'Clarification email sent: to={supplier_email}, '
            f'invoice={invoice_number}, items={len(unmatched_items)}'
        )
        return True

    except aiosmtplib.SMTPException as e:
        logger.error(
            f'SMTP error sending clarification email: '
            f'to={supplier_email}, invoice={invoice_number}, error={e}'
        )
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending clarification email: '
            f'to={supplier_email}, invoice={invoice_number}, error={e}',
            exc_info=True
        )
        return False


async def send_test_email(
    to_email: str
) -> bool:
    """
    Send a test email to verify SMTP configuration.

    Simple test email with basic greeting to confirm email pipeline works.

    Args:
        to_email: Recipient email address

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    if not _check_smtp_config():
        return False

    try:
        msg = EmailMessage()
        msg['From'] = f'{SMTP_FROM_NAME} <{SMTP_EMAIL}>'
        msg['To'] = to_email
        msg['Subject'] = 'Тестовое письмо от ZakupPro'
        msg.set_content(
            'Это тестовое письмо для проверки работы SMTP-сервера.\n\n'
            'Если вы получили это письмо, значит настройка Email успешно выполнена.\n\n'
            f'{SMTP_FROM_NAME}'
        )

        smtp_client = aiosmtplib.SMTP(
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            use_tls=True,
        )

        async with smtp_client:
            await smtp_client.login(SMTP_EMAIL, SMTP_PASSWORD)
            await smtp_client.send_message(msg)

        logger.info(f'Test email sent: to={to_email}')
        return True

    except aiosmtplib.SMTPException as e:
        logger.error(f'SMTP error sending test email: to={to_email}, error={e}')
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending test email: to={to_email}, error={e}',
            exc_info=True
        )
        return False
