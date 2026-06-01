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
