"""
Handlers package for Telegram Bot.

Provides authentication middleware and command/document handlers.
"""

from backend.handlers.auth import AuthMiddleware
from backend.handlers.commands import start_command, help_command
from backend.handlers.documents import handle_document, document_filter

__all__ = [
    'AuthMiddleware',
    'start_command',
    'help_command',
    'handle_document',
    'document_filter',
]
