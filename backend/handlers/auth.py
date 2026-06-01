"""
Authentication middleware for Telegram Bot.

Ensures only authorized chat_ids can access bot commands.
"""

import os
import logging
from typing import Set
from telegram import Update
from telegram.ext import ContextTypes

logger = logging.getLogger(__name__)


class AuthMiddleware:
    """
    Middleware for checking chat_id authorization.

    Loads allowed chat IDs from environment variable and provides
    access control for bot commands.
    """

    def __init__(self) -> None:
        """
        Initialize auth middleware with allowed chat IDs from environment.

        ALLOWED_CHAT_IDS should be comma-separated integers, e.g.:
        ALLOWED_CHAT_IDS=123456789,987654321
        """
        self._allowed_chat_ids: Set[int] = self._load_allowed_ids()

    def _load_allowed_ids(self) -> Set[int]:
        """
        Load allowed chat IDs from environment variable.

        Returns:
            Set of authorized chat IDs as integers.

        Raises:
            ValueError: If ALLOWED_CHAT_IDS is not properly configured.
        """
        env_value = os.getenv('ALLOWED_CHAT_IDS', '')

        if not env_value:
            logger.warning('ALLOWED_CHAT_IDS not set - no access will be granted')
            return set()

        try:
            ids = {
                int(chat_id.strip())
                for chat_id in env_value.split(',')
                if chat_id.strip()
            }
            logger.info(f'Loaded {len(ids)} allowed chat IDs')
            return ids
        except ValueError as e:
            logger.error(f'Invalid ALLOWED_CHAT_IDS format: {e}')
            raise ValueError(
                'ALLOWED_CHAT_IDS must be comma-separated integers, '
                f'e.g. "123456789,987654321"'
            ) from e

    async def check_access(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE
    ) -> bool:
        """
        Check if the update's chat_id is authorized.

        Args:
            update: Telegram update object.
            context: Bot context (unused but required for handler signature).

        Returns:
            True if chat_id is authorized, False otherwise.

        Logs:
            - INFO: Successful authorization with chat_id.
            - WARNING: Failed authorization attempt with chat_id.
        """
        if not update.effective_chat:
            logger.warning('Access check failed: no effective_chat in update')
            return False

        chat_id = update.effective_chat.id

        if chat_id in self._allowed_chat_ids:
            logger.info(f'Access granted: chat_id={chat_id}')
            return True

        logger.warning(f'Access denied: chat_id={chat_id}')
        return False

    @property
    def allowed_chat_ids(self) -> Set[int]:
        """
        Get the set of allowed chat IDs.

        Returns:
            Set of authorized chat IDs.
        """
        return self._allowed_chat_ids.copy()
