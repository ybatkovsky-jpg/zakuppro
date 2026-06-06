"""
Command handlers for Telegram Bot.

Provides /start and /help command handlers with authorization checks.
"""

import logging
from telegram import Update
from telegram.ext import ContextTypes

from backend.handlers.auth import AuthMiddleware

logger = logging.getLogger(__name__)

# Global auth middleware instance
_auth = AuthMiddleware()


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /start command.

    Responds with a welcome message if the user is authorized.
    Logs unauthorized access attempts.

    Args:
        update: Telegram update object.
        context: Bot context.
    """
    if not await _auth.check_access(update, context):
        chat_id = update.effective_chat.id if update.effective_chat else 'unknown'
        if update.effective_message:
            await update.effective_message.reply_text(
                f'⛔ Доступ запрещён. Вы не авторизованы для использования бота.\n\n'
                f'Ваш chat\\_id: `{chat_id}`\n'
                f'Обратитесь к администратору, чтобы добавить ваш chat\\_id в ALLOWED\\_CHAT\\_IDS.',
                parse_mode='Markdown'
            )
        return

    chat_id = update.effective_chat.id
    if update.effective_message:
        await update.effective_message.reply_text(
            '👋 Добро пожаловать в бот ZakupPro!\n\n'
            'Отправьте мне файл Excel (.xlsx), и я обработаю его.\n\n'
            'Используйте /help для списка команд.'
        )
    logger.info(f'Start command handled for chat_id={update.effective_chat.id}')


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /help command.

    Responds with help text if the user is authorized.
    Logs unauthorized access attempts.

    Args:
        update: Telegram update object.
        context: Bot context.
    """
    if not await _auth.check_access(update, context):
        chat_id = update.effective_chat.id if update.effective_chat else 'unknown'
        if update.effective_message:
            await update.effective_message.reply_text(
                f'⛔ Доступ запрещён. Ваш chat\\_id: `{chat_id}`',
                parse_mode='Markdown'
            )
        return

    help_text = (
        '📖 *Справка по боту ZakupPro*\n\n'
        '*Доступные команды:*\n'
        '/start — Начать работу с ботом\n'
        '/help — Показать эту справку\n\n'
        '*Как пользоваться:*\n'
        '1. Отправьте файл Excel (.xlsx)\n'
        '2. Бот сохранит файл и поставит задачу в очередь\n'
        '3. Вы получите ID задачи для отслеживания\n\n'
        '*Требования к файлу:*\n'
        '- Формат: .xlsx (Excel)\n'
        '- Размер: до 20 МБ\n'
        '- Содержимое: данные заказов на закупку'
    )

    if update.effective_message:
        await update.effective_message.reply_text(
            help_text,
            parse_mode='Markdown'
        )
    logger.info(f'Help command handled for chat_id={update.effective_chat.id}')
