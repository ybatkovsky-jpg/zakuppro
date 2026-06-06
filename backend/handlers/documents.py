"""
Document handlers for Telegram Bot.

Handles Excel file uploads, saves files locally, and publishes
processing tasks to RabbitMQ via Celery.
"""

import os
import logging
from pathlib import Path
from telegram import Update
from telegram.ext import ContextTypes, filters

from backend.handlers.auth import AuthMiddleware
from backend.tasks import process_bom_to_project

logger = logging.getLogger(__name__)

# Global auth middleware instance
_auth = AuthMiddleware()

# Upload directory configuration
UPLOAD_DIR = Path('/data/uploads')
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Maximum file size: 20MB
MAX_FILE_SIZE = 20 * 1024 * 1024


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle Excel document uploads from authorized users.

    This handler:
    1. Checks authorization via AuthMiddleware
    2. Downloads the file to /data/uploads/{file_name}
    3. Publishes a Celery task for async processing
    4. Replies to user with task_id and processing status

    Args:
        update: Telegram update object containing document.
        context: Bot context (unused but required for handler signature).
    """
    # Authorization check
    if not await _auth.check_access(update, context):
        chat_id = update.effective_chat.id if update.effective_chat else 'unknown'
        if update.effective_message:
            await update.effective_message.reply_text(
                f'⛔ Доступ запрещён. Ваш chat\\_id: `{chat_id}`',
                parse_mode='Markdown'
            )
        logger.warning(f'Document upload denied: chat_id={chat_id}')
        return

    # Get document from update
    document = update.message.document
    if not document:
        logger.warning('No document in update message')
        return

    chat_id = update.effective_chat.id
    file_name = document.file_name
    file_size = document.file_size

    # Validate file extension
    if not file_name.lower().endswith(('.xlsx', '.xls')):
        logger.warning(f'Invalid file extension: {file_name} from chat_id={chat_id}')
        if update.effective_message:
            await update.effective_message.reply_text(
                f'❌ Неверный формат файла.\n\n'
                f'Пожалуйста, отправляйте только файлы Excel (.xlsx или .xls).\n'
                f'Получен: {file_name}'
            )
        return

    # Validate file size
    if file_size and file_size > MAX_FILE_SIZE:
        logger.warning(f'File too large: {file_name} ({file_size} bytes) from chat_id={chat_id}')
        if update.effective_message:
            await update.effective_message.reply_text(
                f'❌ Файл слишком большой.\n\n'
                f'Максимальный размер: 20 МБ\n'
                f'Ваш файл: {file_size / 1024 / 1024:.2f} МБ'
            )
        return

    logger.info(
        f'Document upload received: file_name={file_name}, '
        f'file_size={file_size}, chat_id={chat_id}'
    )

    try:
        # Download file from Telegram servers
        new_file = await context.bot.get_file(document.file_id)
        file_path = UPLOAD_DIR / file_name

        # Handle duplicate filenames by appending timestamp
        if file_path.exists():
            import time
            stem = Path(file_name).stem
            suffix = Path(file_name).suffix
            file_path = UPLOAD_DIR / f"{stem}_{int(time.time())}{suffix}"

        # Save file locally
        await new_file.download_to_drive(file_path)
        logger.info(f'File saved: {file_path}')

        # Publish Celery task for async processing
        result = process_bom_to_project.delay(str(file_path), chat_id)
        task_id = result.id

        logger.info(
            f'Task published: task_id={task_id}, file_path={file_path}, '
            f'chat_id={chat_id}'
        )

        # Reply to user with confirmation
        if update.effective_message:
            await update.effective_message.reply_text(
                f'✅ Файл получен!\n\n'
                f'📄 Файл: {file_name}\n'
                f'📊 Размер: {file_size / 1024:.2f} КБ\n'
                f'🆔 ID задачи: `{task_id}`\n\n'
                f'Ваш файл обрабатывается. Вы получите уведомление по завершении.',
                parse_mode='Markdown'
            )

    except Exception as e:
        logger.error(
            f'Error processing document: file_name={file_name}, '
            f'chat_id={chat_id}, error={e}',
            exc_info=True
        )
        if update.effective_message:
            await update.effective_message.reply_text(
                f'❌ Ошибка обработки файла.\n\n'
                f'Пожалуйста, попробуйте ещё раз или обратитесь в поддержку.'
            )


# Document filter: only accept Excel files
document_filter = filters.Document.ALL | filters.Document.FileExtension('xlsx')
