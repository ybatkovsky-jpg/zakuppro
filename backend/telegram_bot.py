"""
Telegram Bot main application entry point.

Builds the bot application, registers handlers, and starts polling.
"""

import os
import signal
import logging
from datetime import datetime, timezone
from pathlib import Path

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters
from telegram.error import TelegramError

from backend.handlers.commands import start_command, help_command
from backend.handlers.documents import handle_document, document_filter

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Ensure upload directory exists
UPLOAD_DIR = Path('/data/uploads')
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
logger.info(f'Upload directory ready: {UPLOAD_DIR}')

# Heartbeat file for Docker healthcheck and /health endpoint monitoring
HEARTBEAT_FILE = Path('/data/health/telegram_bot_heartbeat')

# Module-level shutdown flag set by signal handler
shutdown_requested = False


async def _write_heartbeat(context=None) -> None:
    """Write UTC timestamp to heartbeat file atomically.

    Called every 30s by PTB JobQueue. Writes to /data/health/telegram_bot_heartbeat
    so the /health endpoint and Docker healthcheck can verify the bot is alive.
    """
    try:
        HEARTBEAT_FILE.parent.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).isoformat()
        tmp = HEARTBEAT_FILE.with_suffix('.tmp')
        tmp.write_text(timestamp)
        os.replace(tmp, HEARTBEAT_FILE)
    except Exception:
        logger.warning('Failed to write heartbeat', exc_info=True)


def _handle_shutdown(signum: int, frame) -> None:
    """Handle SIGTERM/SIGINT by setting the shutdown flag.

    python-telegram-bot's run_polling() also installs its own handlers that
    call application.stop(). Our handler runs first to set the flag for logging.
    """
    sig_name = signal.Signals(signum).name
    logger.info('Received signal %s (%d), initiating graceful shutdown', sig_name, signum)
    global shutdown_requested
    shutdown_requested = True


async def post_init(application: Application) -> None:
    """Register recurring heartbeat job after application is built."""
    if application.job_queue:
        application.job_queue.run_repeating(_write_heartbeat, interval=30, first=5)
        logger.info('Heartbeat job registered (every 30s)')
    else:
        logger.warning('JobQueue not available — heartbeat will be written on each poll cycle')
        _write_heartbeat()


async def error_handler(update: Update, context) -> None:
    """
    Handle errors that occur during polling or handler execution.

    Args:
        update: Telegram update object (may be None).
        context: Bot context containing error information.
    """
    logger.error(
        f'Exception while handling an update: {context.error}',
        exc_info=context.error
    )

    if update and update.effective_message:
        try:
            await update.effective_message.reply_text(
                '❌ An error occurred while processing your request.\n'
                'Please try again later.'
            )
        except Exception as e:
            logger.error(f'Failed to send error message: {e}')


def main() -> None:
    """
    Main entry point for the Telegram Bot.

    Loads environment variables, builds the Application,
    registers handlers, and starts long polling.
    """
    # Load required environment variables
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        logger.error('TELEGRAM_BOT_TOKEN environment variable not set')
        raise ValueError('TELEGRAM_BOT_TOKEN must be set')

    allowed_chat_ids = os.getenv('ALLOWED_CHAT_IDS', '')
    logger.info(f'ALLOWED_CHAT_IDS configured: {bool(allowed_chat_ids)}')

    # Register signal handlers BEFORE building the application
    # (PTB's run_polling also registers handlers; ours set the flag first)
    signal.signal(signal.SIGTERM, _handle_shutdown)
    signal.signal(signal.SIGINT, _handle_shutdown)
    logger.info('Signal handlers registered for SIGTERM/SIGINT')

    # Build the application
    logger.info('Building Telegram bot application...')
    application = Application.builder().token(bot_token).build()

    # Register post_init callback for heartbeat job
    application.post_init = post_init

    # Register command handlers
    application.add_handler(CommandHandler('start', start_command))
    application.add_handler(CommandHandler('help', help_command))
    logger.info('Command handlers registered: /start, /help')

    # Register document handler for Excel files
    application.add_handler(
        MessageHandler(document_filter, handle_document)
    )
    logger.info('Document handler registered for Excel files')

    # Register error handler
    application.add_error_handler(error_handler)
    logger.info('Error handler registered')

    # Start the bot
    logger.info('Starting bot polling...')
    logger.info('Bot is now running. Press Ctrl+C to stop.')

    try:
        application.run_polling(
            allowed_updates=['message', 'command', 'document']
        )
    except TelegramError as e:
        logger.error(f'Telegram error: {e}', exc_info=True)
        raise
    except KeyboardInterrupt:
        logger.info('Bot stopped by user')
    except Exception as e:
        logger.error(f'Unexpected error: {e}', exc_info=True)
        raise
    finally:
        if shutdown_requested:
            logger.info('Telegram bot shutdown complete')
        else:
            logger.info('Bot shutdown complete')


if __name__ == '__main__':
    main()
