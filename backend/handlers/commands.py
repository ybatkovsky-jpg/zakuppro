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
        if update.effective_message:
            await update.effective_message.reply_text(
                '⛔ Access denied. You are not authorized to use this bot.'
            )
        return

    if update.effective_message:
        await update.effective_message.reply_text(
            '👋 Welcome to ZakupPro Bot!\n\n'
            'Send me an Excel file (.xlsx) and I will process it.\n\n'
            'Use /help to see available commands.'
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
        if update.effective_message:
            await update.effective_message.reply_text(
                '⛔ Access denied. You are not authorized to use this bot.'
            )
        return

    help_text = (
        '📖 *ZakupPro Bot Help*\n\n'
        '*Available Commands:*\n'
        '/start - Start the bot and see welcome message\n'
        '/help - Show this help message\n\n'
        '*How to use:*\n'
        '1. Send an Excel file (.xlsx)\n'
        '2. The bot will save it and queue processing\n'
        '3. You will receive a task ID for tracking\n\n'
        '*File requirements:*\n'
        '- Format: .xlsx (Excel)\n'
        '- Size: up to 20MB\n'
        '- Content: purchase order data'
    )

    if update.effective_message:
        await update.effective_message.reply_text(
            help_text,
            parse_mode='Markdown'
        )
    logger.info(f'Help command handled for chat_id={update.effective_chat.id}')
