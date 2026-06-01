"""
IMAP Client Module for Email Invoice Processing

This module provides IMAPClient class for connecting to IMAP servers,
fetching emails, and extracting attachments for invoice processing.
"""

import email
import imaplib
import logging
import ssl
from email.message import Message
from pathlib import Path
from typing import Optional, List, Tuple, Dict, Any
import time
import os

logger = logging.getLogger(__name__)


class IMAPError(Exception):
    """Base exception for IMAP-related errors."""
    pass


class IMAPConnectionError(IMAPError):
    """Raised when IMAP connection fails."""
    pass


class IMAPAuthenticationError(IMAPError):
    """Raised when IMAP authentication fails."""
    pass


class AttachmentExtractor:
    """Handles extraction of attachments from email messages."""

    # Supported invoice file extensions
    SUPPORTED_EXTENSIONS = {'.pdf', '.xls', '.xlsx', '.xlsm'}

    @classmethod
    def is_supported_file(cls, filename: str) -> bool:
        """Check if file extension is supported for invoice parsing."""
        return Path(filename).suffix.lower() in cls.SUPPORTED_EXTENSIONS

    @classmethod
    def extract_attachments(cls, message: Message) -> List[Tuple[str, bytes, str]]:
        """
        Extract all supported attachments from an email message.

        Args:
            message: email.message.Message object

        Returns:
            List of tuples (filename, content, content_type)

        Raises:
            IMAPError: If attachment extraction fails
        """
        attachments = []

        try:
            for part in message.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get('Content-Disposition', ''))

                # Skip if not an attachment
                if 'attachment' not in content_disposition.lower():
                    continue

                filename = part.get_filename()
                if not filename:
                    continue

                # Check if file is supported
                if not cls.is_supported_file(filename):
                    logger.debug(f"Skipping unsupported file: {filename}")
                    continue

                # Extract file content
                content = part.get_payload(decode=True)
                if content is None:
                    logger.warning(f"Failed to decode attachment: {filename}")
                    continue

                attachments.append((filename, content, content_type))
                logger.info(f"Extracted attachment: {filename} ({len(content)} bytes)")

        except Exception as e:
            raise IMAPError(f"Failed to extract attachments: {e}") from e

        return attachments


class IMAPClient:
    """
    IMAP client for connecting to mail servers and fetching emails with attachments.

    Features:
    - SSL/TLS support
    - Connection retry with exponential backoff
    - Email fetching by UID
    - Attachment extraction
    - Duplicate detection by Message-ID
    """

    def __init__(
        self,
        host: str,
        port: int = 993,
        username: str = '',
        password: str = '',
        use_ssl: bool = True,
        folder: str = 'INBOX',
        max_retries: int = 3,
        retry_delay: int = 1,
    ):
        """
        Initialize IMAP client.

        Args:
            host: IMAP server hostname
            port: IMAP server port (default 993 for SSL, 143 for non-SSL)
            username: IMAP username
            password: IMAP password
            use_ssl: Use SSL/TLS connection (default True)
            folder: Mailbox folder to check (default 'INBOX')
            max_retries: Maximum connection retry attempts
            retry_delay: Initial retry delay in seconds (exponential backoff)
        """
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.folder = folder
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        self.connection: Optional[imaplib.IMAP4] = None
        self._is_connected = False

    def _create_connection(self) -> imaplib.IMAP4:
        """Create and return IMAP connection with SSL if configured."""
        if self.use_ssl:
            context = ssl.create_default_context()
            return imaplib.IMAP4_SSL(self.host, self.port, ssl_context=context)
        return imaplib.IMAP4(self.host, self.port)

    def connect(self) -> bool:
        """
        Connect to IMAP server and authenticate.

        Returns:
            True if connection successful

        Raises:
            IMAPConnectionError: If connection fails after retries
            IMAPAuthenticationError: If authentication fails
        """
        if self._is_connected:
            logger.debug("Already connected to IMAP server")
            return True

        last_error = None

        for attempt in range(self.max_retries):
            try:
                logger.info(f"Connecting to IMAP server {self.host}:{self.port} (attempt {attempt + 1}/{self.max_retries})")

                # Create connection
                self.connection = self._create_connection()

                # Authenticate
                self.connection.login(self.username, self.password)
                logger.info(f"Authenticated as {self.username}")

                # Select folder
                self.connection.select(self.folder)
                logger.info(f"Selected folder: {self.folder}")

                self._is_connected = True
                return True

            except imaplib.IMAP4.error as e:
                last_error = e
                if 'authentication failed' in str(e).lower() or 'login failed' in str(e).lower():
                    raise IMAPAuthenticationError(f"IMAP authentication failed for user {self.username}") from e

                # Retry with exponential backoff for other errors
                delay = self.retry_delay * (2 ** attempt)
                logger.warning(f"IMAP connection attempt {attempt + 1} failed: {e}. Retrying in {delay}s...")
                time.sleep(delay)

            except Exception as e:
                last_error = e
                logger.error(f"Unexpected error during IMAP connection: {e}")
                delay = self.retry_delay * (2 ** attempt)
                time.sleep(delay)

        raise IMAPConnectionError(f"Failed to connect to IMAP server after {self.max_retries} attempts") from last_error

    def disconnect(self) -> None:
        """Close IMAP connection gracefully."""
        if self.connection and self._is_connected:
            try:
                self.connection.close()
                self.connection.logout()
                logger.info("Disconnected from IMAP server")
            except Exception as e:
                logger.warning(f"Error during IMAP disconnect: {e}")
            finally:
                self.connection = None
                self._is_connected = False

    def __enter__(self):
        """Context manager entry."""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.disconnect()

    def _ensure_connected(self) -> None:
        """Ensure connection is active, reconnect if needed."""
        if not self._is_connected or not self.connection:
            logger.warning("Connection lost, attempting to reconnect...")
            self.connect()

    def fetch_unread_emails(self) -> List[Tuple[str, Message]]:
        """
        Fetch all unread emails from the selected folder.

        Returns:
            List of tuples (uid, email_message)

        Raises:
            IMAPError: If fetching fails
        """
        self._ensure_connected()

        try:
            # Search for unread emails
            status, messages = self.connection.search(None, 'UNSEEN')
            if status != 'OK':
                raise IMAPError(f"IMAP search failed: {messages}")

            email_uids = messages[0].split()
            logger.info(f"Found {len(email_uids)} unread emails")

            if not email_uids:
                return []

            emails = []

            # Fetch each email
            for uid in email_uids:
                uid_str = uid.decode() if isinstance(uid, bytes) else uid
                try:
                    # Fetch email body
                    status, msg_data = self.connection.fetch(uid, '(RFC822)')
                    if status != 'OK':
                        logger.warning(f"Failed to fetch email UID {uid_str}")
                        continue

                    # Parse email message
                    raw_email = msg_data[0][1]
                    message = email.message_from_bytes(raw_email)

                    emails.append((uid_str, message))
                    logger.debug(f"Fetched email UID {uid_str}: {message.get('Subject', '(no subject)')}")

                except Exception as e:
                    logger.error(f"Error fetching email UID {uid_str}: {e}")
                    continue

            logger.info(f"Successfully fetched {len(emails)} emails")
            return emails

        except imaplib.IMAP4.error as e:
            raise IMAPError(f"IMAP error while fetching emails: {e}") from e

    def mark_as_read(self, uid: str) -> bool:
        """
        Mark an email as read by removing the \\Seen flag removal.

        Args:
            uid: Email UID to mark as read

        Returns:
            True if successful
        """
        self._ensure_connected()

        try:
            # Store command removes flags when prefixed with -
            status, response = self.connection.store(uid, '+FLAGS', '\\Seen')
            if status == 'OK':
                logger.debug(f"Marked email UID {uid} as read")
                return True
            return False
        except Exception as e:
            logger.error(f"Failed to mark email UID {uid} as read: {e}")
            return False

    def get_message_id(self, message: Message) -> str:
        """
        Extract Message-ID header from email.

        Args:
            message: Email message object

        Returns:
            Message-ID string or empty string if not found
        """
        return message.get('Message-ID', '')

    def extract_attachments(self, message: Message) -> List[Tuple[str, bytes, str]]:
        """
        Extract supported invoice attachments from email message.

        Args:
            message: Email message object

        Returns:
            List of tuples (filename, content, content_type)
        """
        return AttachmentExtractor.extract_attachments(message)


def create_imap_client_from_env() -> IMAPClient:
    """
    Create IMAPClient instance from environment variables.

    Environment variables:
        IMAP_HOST: IMAP server hostname (required)
        IMAP_PORT: IMAP server port (default: 993)
        IMAP_USER: IMAP username (required)
        IMAP_PASS: IMAP password (required)
        IMAP_USE_SSL: Use SSL/TLS (default: true)
        IMAP_FOLDER: Mailbox folder (default: INBOX)
        IMAP_MAX_RETRIES: Maximum retry attempts (default: 3)
        IMAP_RETRY_DELAY: Initial retry delay seconds (default: 1)

    Returns:
        Configured IMAPClient instance

    Raises:
        ValueError: If required environment variables are missing
    """
    host = os.getenv('IMAP_HOST')
    username = os.getenv('IMAP_USER')
    password = os.getenv('IMAP_PASS')

    if not all([host, username, password]):
        missing = [v for v in ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASS'] if not os.getenv(v)]
        raise ValueError(f"Missing required IMAP environment variables: {', '.join(missing)}")

    return IMAPClient(
        host=host,
        port=int(os.getenv('IMAP_PORT', '993')),
        username=username,
        password=password,
        use_ssl=os.getenv('IMAP_USE_SSL', 'true').lower() == 'true',
        folder=os.getenv('IMAP_FOLDER', 'INBOX'),
        max_retries=int(os.getenv('IMAP_MAX_RETRIES', '3')),
        retry_delay=int(os.getenv('IMAP_RETRY_DELAY', '1')),
    )
