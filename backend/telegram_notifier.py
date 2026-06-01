"""
Telegram Notification Helper for Celery tasks.

Provides functions for sending outbound messages from Celery tasks:
- Completion notifications to users
- DLQ alerts to owner

Uses python-telegram-bot Bot class with TELEGRAM_BOT_TOKEN env var.
"""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Optional import guard for telegram.Bot availability
try:
    from telegram import Bot
    from telegram.error import TelegramError
    TELEGRAM_AVAILABLE = True
except ImportError:
    logger.warning(
        'python-telegram-bot not available. '
        'Telegram notifications will be disabled.'
    )
    TELEGRAM_AVAILABLE = False
    Bot = None  # type: ignore
    TelegramError = Exception  # type: ignore


# Environment variables
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
OWNER_CHAT_ID = os.getenv('TELEGRAM_OWNER_CHAT_ID')


def _get_bot() -> Optional[Bot]:
    """
    Get initialized Bot instance.

    Returns None if:
    - telegram library is not available
    - TELEGRAM_BOT_TOKEN is not set

    Returns:
        Bot instance or None
    """
    if not TELEGRAM_AVAILABLE:
        logger.error('Telegram library not available')
        return None

    if not BOT_TOKEN:
        logger.error('TELEGRAM_BOT_TOKEN environment variable not set')
        return None

    try:
        return Bot(token=BOT_TOKEN)
    except Exception as e:
        logger.error(f'Failed to initialize Bot: {e}')
        return None


def send_completion_message(
    chat_id: int,
    project_name: str,
    items_count: int,
    reserved_count: int = 0
) -> bool:
    """
    Send completion message to user with processing statistics.

    Message format (Russian):
        ✅ Обработка завершена!
        📁 Проект: {project_name}
        📊 Товаров: {items_count}
        📦 Резерв: {reserved_count}

    Args:
        chat_id: Telegram chat_id to send message to
        project_name: Name of the project created
        items_count: Number of ProjectItems created
        reserved_count: Number of items with reservation status (optional)

    Returns:
        bool: True if message sent successfully, False otherwise
    """
    bot = _get_bot()
    if not bot:
        return False

    message = (
        f'✅ Обработка завершена!\n\n'
        f'📁 Проект: {project_name}\n'
        f'📊 Товаров: {items_count}\n'
    )

    if reserved_count > 0:
        message += f'📦 В резерве: {reserved_count}\n'

    try:
        bot.send_message(chat_id=chat_id, text=message)
        logger.info(
            f'Completion message sent: chat_id={chat_id}, '
            f'project={project_name}, items={items_count}'
        )
        return True

    except TelegramError as e:
        logger.error(
            f'Failed to send completion message: chat_id={chat_id}, error={e}'
        )
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending completion message: chat_id={chat_id}, error={e}',
            exc_info=True
        )
        return False


def send_dlq_alert(
    task_id: str,
    error_message: str,
    file_path: str,
    chat_id: Optional[int] = None
) -> bool:
    """
    Send DLQ alert to owner about failed task.

    Message format (Russian):
        🚨 DLQ Alert
        Task: {task_id}
        File: {file_path}
        Error: {error_message}

    Args:
        task_id: Celery task ID that failed
        error_message: Error message or exception details
        file_path: Path to the file being processed
        chat_id: Optional user chat_id for context

    Returns:
        bool: True if message sent successfully, False otherwise
    """
    bot = _get_bot()
    if not bot:
        return False

    if not OWNER_CHAT_ID:
        logger.error('TELEGRAM_OWNER_CHAT_ID environment variable not set')
        return False

    message = (
        f'🚨 *DLQ Alert*\n\n'
        f'🆔 Task: `{task_id}`\n'
        f'📄 File: {file_path}\n'
    )

    if chat_id:
        message += f'💬 User chat_id: {chat_id}\n'

    message += f'\n❌ Error:\n```\n{error_message}\n```'

    try:
        bot.send_message(
            chat_id=OWNER_CHAT_ID,
            text=message,
            parse_mode='Markdown'
        )
        logger.info(
            f'DLQ alert sent: task_id={task_id}, file={file_path}, '
            f'owner_chat_id={OWNER_CHAT_ID}'
        )
        return True

    except TelegramError as e:
        logger.error(
            f'Failed to send DLQ alert: task_id={task_id}, error={e}'
        )
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending DLQ alert: task_id={task_id}, error={e}',
            exc_info=True
        )
        return False


def send_invoice_verified(
    chat_id: int,
    invoice_id: int,
    stats: dict
) -> bool:
    """
    Send success notification when invoice verification completes successfully.

    Message format (Russian):
        ✅ Счет сверен
        📄 Счет #{invoice_id}
        📊 Статистика: {stats}

    Args:
        chat_id: Telegram chat_id to send message to
        invoice_id: ID of the verified invoice
        stats: Dictionary with verification statistics (matched, total, confidence)

    Returns:
        bool: True if message sent successfully, False otherwise
    """
    bot = _get_bot()
    if not bot:
        return False

    message = (
        f'✅ *Счет сверен*\n\n'
        f'📄 Счет №: `{invoice_id}`\n'
        f'🔗 Совпадений: {stats.get("matched", 0)}/{stats.get("total", 0)}\n'
    )

    if 'confidence' in stats:
        message += f'📈 Точность: {stats["confidence"]:.1%}\n'

    try:
        bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='Markdown'
        )
        logger.info(
            f'Invoice verified notification sent: chat_id={chat_id}, '
            f'invoice_id={invoice_id}, matched={stats.get("matched", 0)}'
        )
        return True

    except TelegramError as e:
        logger.error(
            f'Failed to send invoice verified notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}'
        )
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending invoice verified notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}',
            exc_info=True
        )
        return False


def send_invoice_partial(
    chat_id: int,
    invoice_id: int,
    discrepancies: list
) -> bool:
    """
    Send warning notification when invoice verification finds quantity discrepancies.

    Message format (Russian):
        ⚠️ Частичное совпадение
        📄 Счет #{invoice_id}
        📊 Расхождения: {discrepancies}

    Args:
        chat_id: Telegram chat_id to send message to
        invoice_id: ID of the partially matched invoice
        discrepancies: List of discrepancy descriptions

    Returns:
        bool: True if message sent successfully, False otherwise
    """
    bot = _get_bot()
    if not bot:
        return False

    message = (
        f'⚠️ *Частичное совпадение*\n\n'
        f'📄 Счет №: `{invoice_id}`\n'
        f'🔍 Найдены расхождения в количестве:\n'
    )

    for idx, disc in enumerate(discrepancies[:5], 1):
        message += f'  {idx}. {disc}\n'

    if len(discrepancies) > 5:
        message += f'  ... и еще {len(discrepancies) - 5}\n'

    try:
        bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='Markdown'
        )
        logger.info(
            f'Invoice partial notification sent: chat_id={chat_id}, '
            f'invoice_id={invoice_id}, discrepancies={len(discrepancies)}'
        )
        return True

    except TelegramError as e:
        logger.error(
            f'Failed to send invoice partial notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}'
        )
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending invoice partial notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}',
            exc_info=True
        )
        return False


def send_invoice_clarification_needed(
    chat_id: int,
    invoice_id: int,
    fuzzy_matches: list
) -> bool:
    """
    Send alert when invoice requires supplier clarification via fuzzy matching.

    Message format (Russian):
        🔔 Требуется уточнение
        📄 Счет #{invoice_id}
        📝 Возможные совпадения: {fuzzy_matches}

    Args:
        chat_id: Telegram chat_id to send message to
        invoice_id: ID of the invoice needing clarification
        fuzzy_matches: List of fuzzy match candidates with confidence scores

    Returns:
        bool: True if message sent successfully, False otherwise
    """
    bot = _get_bot()
    if not bot:
        return False

    message = (
        f'🔔 *Требуется уточнение*\n\n'
        f'📄 Счет №: `{invoice_id}`\n'
        f'🔍 Найдены возможные совпадения (требуется подтверждение):\n'
    )

    for idx, match in enumerate(fuzzy_matches[:3], 1):
        name = match.get('name', 'Unknown')
        confidence = match.get('confidence', 0)
        message += f'  {idx}. {name} ({confidence:.0%})\n'

    if len(fuzzy_matches) > 3:
        message += f'  ... и еще {len(fuzzy_matches) - 3}\n'

    message += '\n💡 Отправьте письмо поставщику для уточнения.'

    try:
        bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='Markdown'
        )
        logger.info(
            f'Invoice clarification notification sent: chat_id={chat_id}, '
            f'invoice_id={invoice_id}, matches={len(fuzzy_matches)}'
        )
        return True

    except TelegramError as e:
        logger.error(
            f'Failed to send invoice clarification notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}'
        )
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending invoice clarification notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}',
            exc_info=True
        )
        return False


def send_invoice_failed(
    chat_id: int,
    invoice_id: int,
    error: str
) -> bool:
    """
    Send critical alert when invoice verification fails.

    Message format (Russian):
        🚨 Ошибка сверка счета
        📄 Счет #{invoice_id}
        ❌ Ошибка: {error}

    Args:
        chat_id: Telegram chat_id to send message to
        invoice_id: ID of the failed invoice
        error: Error message describing the failure

    Returns:
        bool: True if message sent successfully, False otherwise
    """
    bot = _get_bot()
    if not bot:
        return False

    message = (
        f'🚨 *Ошибка сверка счета*\n\n'
        f'📄 Счет №: `{invoice_id}`\n'
        f'\n❌ Ошибка:\n```\n{error}\n```'
    )

    try:
        bot.send_message(
            chat_id=chat_id,
            text=message,
            parse_mode='Markdown'
        )
        logger.info(
            f'Invoice failed notification sent: chat_id={chat_id}, '
            f'invoice_id={invoice_id}'
        )
        return True

    except TelegramError as e:
        logger.error(
            f'Failed to send invoice failed notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}'
        )
        return False
    except Exception as e:
        logger.error(
            f'Unexpected error sending invoice failed notification: '
            f'chat_id={chat_id}, invoice_id={invoice_id}, error={e}',
            exc_info=True
        )
        return False
