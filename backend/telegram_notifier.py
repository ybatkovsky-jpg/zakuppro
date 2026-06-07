"""
Telegram Notification Helper for Celery tasks.

Provides functions for sending outbound messages from Celery tasks:
- Completion notifications to users
- DLQ alerts to owner
- Processing error notifications

Uses python-telegram-bot Bot class with TELEGRAM_BOT_TOKEN env var.
All send operations run synchronously via asyncio.run() since Celery
workers are synchronous.
"""

import os
import logging
import asyncio
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


def _sync_send(bot: Bot, chat_id: int, text: str, parse_mode: Optional[str] = None) -> bool:
    """
    Synchronously send a Telegram message from a Celery worker.

    python-telegram-bot v21+ uses async Bot.send_message(), but Celery
    workers are synchronous. We use asyncio.run() to bridge the gap.

    Returns:
        True if sent successfully, False otherwise
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're inside an existing event loop — create a new one in a thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode)
                )
                future.result(timeout=30)
        else:
            asyncio.run(bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode))
        return True
    except Exception as e:
        if isinstance(e, TelegramError):
            raise
        logger.error(f'Failed to send Telegram message: {e}')
        return False


def send_completion_message(
    chat_id: int,
    project_name: str,
    items_count: int,
    reserved_count: int = 0
) -> bool:
    """
    Send completion message to user with processing statistics.

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
        _sync_send(bot, chat_id=chat_id, text=message)
        logger.info(
            f'Completion message sent: chat_id={chat_id}, '
            f'project={project_name}, items={items_count}'
        )
        return True
    except Exception as e:
        logger.error(f'Error sending completion message: {e}', exc_info=True)
        return False


def send_processing_error(
    chat_id: int,
    error_message: str,
) -> bool:
    """
    Send processing error message to the user who uploaded a file.

    Args:
        chat_id: Telegram chat_id to send message to
        error_message: Short error description

    Returns:
        bool: True if message sent successfully, False otherwise
    """
    bot = _get_bot()
    if not bot:
        return False

    # Truncate error message to avoid Telegram message length limit
    display_error = error_message[:500] if len(error_message) > 500 else error_message

    message = (
        f'❌ *Ошибка обработки файла*\n\n'
        f'Ваш файл не удалось обработать.\n\n'
        f'📄 Ошибка:\n```\n{display_error}\n```\n\n'
        f'Пожалуйста, проверьте формат файла или обратитесь в поддержку.'
    )

    try:
        _sync_send(bot, chat_id=chat_id, text=message, parse_mode='Markdown')
        logger.info(f'Processing error notification sent: chat_id={chat_id}')
        return True
    except Exception as e:
        logger.error(f'Error sending processing error notification: {e}', exc_info=True)
        return False


def send_dlq_alert(
    task_id: str,
    error_message: str,
    file_path: str,
    chat_id: Optional[int] = None
) -> bool:
    """
    Send DLQ alert to owner about failed task.

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
        _sync_send(bot, chat_id=int(OWNER_CHAT_ID), text=message, parse_mode='Markdown')
        logger.info(
            f'DLQ alert sent: task_id={task_id}, file={file_path}, '
            f'owner_chat_id={OWNER_CHAT_ID}'
        )
        return True
    except Exception as e:
        logger.error(f'Error sending DLQ alert: {e}', exc_info=True)
        return False


def send_invoice_verified(chat_id: int, invoice_id: int, stats: dict) -> bool:
    """Send success notification when invoice verification completes."""
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
        _sync_send(bot, chat_id=chat_id, text=message, parse_mode='Markdown')
        return True
    except Exception as e:
        logger.error(f'Error sending invoice verified: {e}', exc_info=True)
        return False


def send_invoice_partial(chat_id: int, invoice_id: int, discrepancies: list) -> bool:
    """Send warning notification when invoice verification finds quantity discrepancies."""
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
        _sync_send(bot, chat_id=chat_id, text=message, parse_mode='Markdown')
        return True
    except Exception as e:
        logger.error(f'Error sending invoice partial: {e}', exc_info=True)
        return False


def send_invoice_failed(chat_id: int, invoice_id: int, error: str) -> bool:
    """Send critical alert when invoice verification fails."""
    bot = _get_bot()
    if not bot:
        return False

    message = (
        f'🚨 *Ошибка сверка счета*\n\n'
        f'📄 Счет №: `{invoice_id}`\n'
        f'\n❌ Ошибка:\n```\n{error}\n```'
    )

    try:
        _sync_send(bot, chat_id=chat_id, text=message, parse_mode='Markdown')
        return True
    except Exception as e:
        logger.error(f'Error sending invoice failed: {e}', exc_info=True)
        return False
