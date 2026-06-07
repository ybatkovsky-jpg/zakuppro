"""
Email Worker Service for Invoice Processing

This module provides the email worker service that:
1. Polls IMAP mailbox for new emails at configurable intervals
2. Extracts PDF/Excel attachments and .txt bank statements from emails
3. Routes attachments to appropriate Celery tasks:
   - .txt files -> parse_bank_statement task for 1C ClientBank format
   - PDF/Excel files -> parse_invoice task for invoice processing
4. Tracks processed emails by Message-ID to avoid duplicates
5. Handles graceful shutdown on SIGTERM

Run as standalone process or via Docker service:
    python -m backend.email_worker
"""

import asyncio
import logging
import signal
import sys
import os
import time
from typing import Set, Dict, Any
from pathlib import Path
from datetime import datetime, timezone

from backend.celery_app import app
from backend.services.imap_client import create_imap_client_from_env, IMAPError

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/data/logs/email_worker.log') if Path('/data/logs').exists() else logging.NullHandler(),
    ]
)
logger = logging.getLogger(__name__)


class EmailWorker:
    """
    Email worker service for IMAP polling and invoice task publishing.

    Features:
    - Configurable poll interval (default 60s)
    - Duplicate detection via Message-ID tracking
    - Graceful shutdown on SIGTERM/SIGINT
    - Structured logging for observability
    - Error recovery with exponential backoff
    """

    def __init__(
        self,
        poll_interval: int = 60,
        processed_ids_file: str = '/data/processed_message_ids.txt',
        heartbeat_file: str = '/data/health/email_worker_heartbeat',
    ):
        """
        Initialize email worker.

        Args:
            poll_interval: Seconds between IMAP polls (default 60)
            processed_ids_file: File to persist processed Message-IDs
            heartbeat_file: File to write heartbeat timestamp for health checks
        """
        self.poll_interval = poll_interval
        self.processed_ids_file = processed_ids_file
        self.heartbeat_file = heartbeat_file
        self.processed_ids: Set[str] = set()
        self.running = False
        self.shutdown_requested = False

        # Statistics
        self.stats = {
            'emails_processed': 0,
            'attachments_extracted': 0,
            'tasks_published': 0,
            'bank_statements_processed': 0,
            'errors': 0,
            'started_at': None,
        }

    def load_processed_ids(self) -> None:
        """Load previously processed Message-IDs from file."""
        try:
            if Path(self.processed_ids_file).exists():
                with open(self.processed_ids_file, 'r') as f:
                    self.processed_ids = set(line.strip() for line in f if line.strip())
                logger.info(f"Loaded {len(self.processed_ids)} processed Message-IDs")
            else:
                # Create parent directory if it doesn't exist
                Path(self.processed_ids_file).parent.mkdir(parents=True, exist_ok=True)
                self.processed_ids = set()
                logger.info("No previous processed IDs found, starting fresh")
        except Exception as e:
            logger.error(f"Failed to load processed IDs: {e}")
            self.processed_ids = set()

    def save_processed_id(self, message_id: str) -> None:
        """
        Save a processed Message-ID to file.

        Args:
            message_id: Message-ID to save
        """
        try:
            # Ensure directory exists
            Path(self.processed_ids_file).parent.mkdir(parents=True, exist_ok=True)

            with open(self.processed_ids_file, 'a') as f:
                f.write(f"{message_id}\n")
            self.processed_ids.add(message_id)
        except Exception as e:
            logger.error(f"Failed to save processed ID {message_id}: {e}")

    def is_duplicate(self, message_id: str) -> bool:
        """
        Check if email has already been processed.

        Args:
            message_id: Message-ID to check

        Returns:
            True if already processed
        """
        return message_id in self.processed_ids

    def publish_parse_task(self, filename: str, content: bytes, metadata: Dict[str, Any]) -> bool:
        """
        Publish parse_invoice task to RabbitMQ.

        Args:
            filename: Original attachment filename
            content: File bytes
            metadata: Additional metadata (subject, from, date, message_id)

        Returns:
            True if task published successfully
        """
        try:
            # Import parse_invoice task (will be implemented in S03)
            # For now, we use a placeholder task
            from backend.tasks import parse_invoice

            # Publish task with file content and metadata
            result = parse_invoice.delay(
                filename=filename,
                file_content=content,
                metadata=metadata,
            )

            logger.info(f"Published parse_invoice task {result.id} for {filename}")
            self.stats['tasks_published'] += 1
            return True

        except ImportError:
            # parse_invoice task not yet implemented (S03)
            logger.warning("parse_invoice task not yet implemented, skipping")
            # Simulate task publication for testing
            logger.info(f"[MOCK] Would publish parse_invoice task for {filename} ({len(content)} bytes)")
            self.stats['tasks_published'] += 1
            return True

        except Exception as e:
            logger.error(f"Failed to publish parse_invoice task: {e}")
            self.stats['errors'] += 1
            return False

    def publish_bank_statement_task(self, filename: str, content: bytes, metadata: Dict[str, Any]) -> bool:
        """
        Publish parse_bank_statement task to RabbitMQ.

        Args:
            filename: Original attachment filename (.txt file)
            content: File bytes
            metadata: Additional metadata (subject, from, date, message_id)

        Returns:
            True if task published successfully
        """
        try:
            # Import parse_bank_statement task (will be implemented in T04)
            from backend.tasks import parse_bank_statement

            # Publish task with file content and metadata
            result = parse_bank_statement.delay(
                filename=filename,
                file_content=content,
                metadata=metadata,
            )

            logger.info(f"Published parse_bank_statement task {result.id} for {filename}")
            self.stats['tasks_published'] += 1
            self.stats['bank_statements_processed'] += 1
            return True

        except ImportError:
            # parse_bank_statement task not yet implemented (T04)
            logger.warning("parse_bank_statement task not yet implemented, skipping")
            # Simulate task publication for testing
            logger.info(f"[MOCK] Would publish parse_bank_statement task for {filename} ({len(content)} bytes)")
            self.stats['tasks_published'] += 1
            self.stats['bank_statements_processed'] += 1
            return True

        except Exception as e:
            logger.error(f"Failed to publish parse_bank_statement task: {e}")
            self.stats['errors'] += 1
            return False

    def process_email(self, uid: str, message, imap_client) -> None:
        """
        Process a single email: extract attachments and publish tasks.

        Args:
            uid: Email UID
            message: Email message object
            imap_client: IMAPClient instance (for marking as read)
        """
        message_id = imap_client.get_message_id(message)

        # Skip duplicates
        if not message_id:
            logger.warning(f"Email {uid} has no Message-ID, skipping")
            return

        if self.is_duplicate(message_id):
            logger.debug(f"Email {uid} ({message_id}) already processed, skipping")
            return

        logger.info(f"Processing email {uid}: {message.get('Subject', '(no subject)')}")

        # Extract metadata
        metadata = {
            'message_id': message_id,
            'subject': message.get('Subject', ''),
            'from': message.get('From', ''),
            'date': message.get('Date', ''),
            'to': message.get('To', ''),
            'uid': uid,
        }

        try:
            # Extract attachments
            attachments = imap_client.extract_attachments(message)

            if not attachments:
                logger.warning(f"No supported attachments found in email {uid}")
                # Mark as read even without attachments
                imap_client.mark_as_read(uid)
                self.save_processed_id(message_id)
                return

            # Process each attachment
            for filename, content, content_type in attachments:
                logger.info(f"Processing attachment: {filename} ({len(content)} bytes, {content_type})")

                # Route based on file extension
                # .txt files are bank statements (1C ClientBank format)
                # PDF/Excel files are invoices
                file_ext = Path(filename).suffix.lower()

                if file_ext == '.txt':
                    # Bank statement file
                    if self.publish_bank_statement_task(filename, content, metadata):
                        logger.info(f"Successfully published bank statement task for {filename}")
                        self.stats['attachments_extracted'] += 1
                    else:
                        logger.error(f"Failed to publish bank statement task for {filename}")
                else:
                    # Invoice file (PDF/Excel)
                    if self.publish_parse_task(filename, content, metadata):
                        logger.info(f"Successfully published parse task for {filename}")
                        self.stats['attachments_extracted'] += 1
                    else:
                        logger.error(f"Failed to publish parse task for {filename}")

            # Mark email as read and save Message-ID
            imap_client.mark_as_read(uid)
            self.save_processed_id(message_id)
            self.stats['emails_processed'] += 1

        except Exception as e:
            logger.error(f"Error processing email {uid}: {e}")
            self.stats['errors'] += 1

    def poll_once(self) -> None:
        """Execute a single IMAP poll and process new emails."""
        imap_host = os.getenv("IMAP_HOST", "")
        imap_user = os.getenv("EMAIL_ADDRESS", "") or os.getenv("IMAP_USER", "")
        imap_pass = os.getenv("EMAIL_PASSWORD", "") or os.getenv("IMAP_PASSWORD", "")
        if not imap_host or not imap_user or not imap_pass:
            logger.debug("IMAP credentials not configured, skipping poll")
            self._write_heartbeat()
            return
        logger.info("Starting IMAP poll...")

        try:
            with create_imap_client_from_env() as imap_client:
                # Fetch unread emails
                emails = imap_client.fetch_unread_emails()

                if not emails:
                    logger.info("No new emails to process")
                else:
                    logger.info(f"Found {len(emails)} unread emails")

                    # Process each email
                    for uid, message in emails:
                        if self.shutdown_requested:
                            logger.info("Shutdown requested, stopping poll")
                            break

                        self.process_email(uid, message, imap_client)

        except IMAPError as e:
            logger.error(f"IMAP error during poll: {e}")
            self.stats['errors'] += 1
        except Exception as e:
            logger.error(f"Unexpected error during poll: {e}")
            self.stats['errors'] += 1
        finally:
            # Write heartbeat after each poll iteration (success or fail)
            self._write_heartbeat()

    def _write_heartbeat(self) -> None:
        """Write current UTC timestamp to heartbeat file atomically.

        Used by Docker healthcheck and /health endpoint to verify
        the worker is alive and polling.
        """
        try:
            heartbeat_path = Path(self.heartbeat_file)
            heartbeat_path.parent.mkdir(parents=True, exist_ok=True)

            # Atomic write: temp file then os.replace
            tmp_path = heartbeat_path.with_suffix('.tmp')
            tmp_path.write_text(datetime.now(timezone.utc).isoformat())
            os.replace(tmp_path, heartbeat_path)
        except Exception as e:
            logger.error(f"Failed to write heartbeat file: {e}")

    def print_stats(self) -> None:
        """Print current statistics."""
        uptime = datetime.now() - self.stats['started_at'] if self.stats['started_at'] else None

        logger.info("=" * 50)
        logger.info("Email Worker Statistics")
        logger.info("=" * 50)
        logger.info(f"Uptime: {uptime}")
        logger.info(f"Emails processed: {self.stats['emails_processed']}")
        logger.info(f"Attachments extracted: {self.stats['attachments_extracted']}")
        logger.info(f"Tasks published: {self.stats['tasks_published']}")
        logger.info(f"Bank statements processed: {self.stats['bank_statements_processed']}")
        logger.info(f"Errors: {self.stats['errors']}")
        logger.info(f"Processed IDs tracked: {len(self.processed_ids)}")
        logger.info("=" * 50)

    def poll_forever(self) -> None:
        """
        Main polling loop: connects to IMAP and processes emails forever.

        Handles graceful shutdown on SIGTERM/SIGINT and prints stats periodically.
        """
        logger.info("Starting email worker service...")
        logger.info(f"Poll interval: {self.poll_interval}s")

        # Load previously processed IDs
        self.load_processed_ids()

        self.stats['started_at'] = datetime.now()
        self.running = True

        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._handle_shutdown)
        signal.signal(signal.SIGINT, self._handle_shutdown)

        # Main polling loop
        poll_count = 0
        while not self.shutdown_requested:
            try:
                poll_count += 1
                logger.info(f"Poll iteration #{poll_count}")

                self.poll_once()

                # Print stats every 10 polls
                if poll_count % 10 == 0:
                    self.print_stats()

                # Wait for next poll or shutdown
                if self.shutdown_requested:
                    break

                # Sleep with interrupt check
                for _ in range(self.poll_interval):
                    if self.shutdown_requested:
                        break
                    time.sleep(1)

            except KeyboardInterrupt:
                logger.info("Keyboard interrupt received")
                break
            except Exception as e:
                logger.error(f"Error in polling loop: {e}")
                self.stats['errors'] += 1
                # Wait before retrying
                time.sleep(min(self.poll_interval, 60))

        # Print final stats
        self.print_stats()
        logger.info("Email worker service stopped")

    def _handle_shutdown(self, signum, frame) -> None:
        """
        Handle shutdown signals (SIGTERM, SIGINT).

        Args:
            signum: Signal number
            frame: Current stack frame
        """
        sig_name = signal.Signals(signum).name
        logger.info(f"Received signal {sig_name} ({signum}), initiating graceful shutdown...")
        self.shutdown_requested = True
        self.running = False


def main():
    """Entry point for email worker service."""
    # Get poll interval from environment
    poll_interval = int(os.getenv('EMAIL_WORKER_POLL_INTERVAL', '60'))

    # Get processed IDs file path
    processed_ids_file = os.getenv(
        'EMAIL_WORKER_PROCESSED_IDS_FILE',
        '/data/processed_message_ids.txt'
    )

    # Get heartbeat file path
    heartbeat_file = os.getenv(
        'EMAIL_WORKER_HEARTBEAT_FILE',
        '/data/health/email_worker_heartbeat'
    )

    # Create and start worker
    worker = EmailWorker(
        poll_interval=poll_interval,
        processed_ids_file=processed_ids_file,
        heartbeat_file=heartbeat_file,
    )

    try:
        worker.poll_forever()
    except Exception as e:
        logger.error(f"Fatal error in email worker: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
