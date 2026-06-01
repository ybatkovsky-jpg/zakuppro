"""
Unit tests for Email Worker Service
"""

import pytest
from unittest.mock import Mock, MagicMock, patch, call
from email.message import Message
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import signal
import tempfile

from backend.email_worker import EmailWorker


class TestEmailWorker:
    """Tests for EmailWorker class."""

    @pytest.fixture
    def worker(self):
        """Create test EmailWorker instance with temp file."""
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as f:
            temp_file = f.name
        return EmailWorker(poll_interval=10, processed_ids_file=temp_file)

    @pytest.fixture
    def mock_imap_client(self):
        """Create mock IMAPClient."""
        client = Mock()
        client.fetch_unread_emails.return_value = []
        client.get_message_id.return_value = '<test@example.com>'
        client.extract_attachments.return_value = []
        client.mark_as_read.return_value = True
        return client

    @pytest.fixture
    def sample_email(self):
        """Create sample email with PDF attachment."""
        message = MIMEMultipart()
        message['Subject'] = 'Invoice #12345'
        message['From'] = 'supplier@example.com'
        message['To'] = 'invoices@company.com'
        message['Message-ID'] = '<msg123@example.com>'
        message['Date'] = 'Mon, 01 Jun 2026 12:00:00 +0000'

        # Add PDF attachment
        pdf_part = MIMEApplication(b'%PDF-1.4 test invoice content', _subtype='pdf')
        pdf_part.add_header('Content-Disposition', 'attachment; filename="invoice.pdf"')
        message.attach(pdf_part)

        return message

    def test_init_defaults(self):
        """Test EmailWorker initialization with defaults."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            temp_file = f.name

        worker = EmailWorker(processed_ids_file=temp_file)

        assert worker.poll_interval == 60
        assert worker.processed_ids_file == temp_file
        assert worker.processed_ids == set()
        assert worker.running is False
        assert worker.shutdown_requested is False
        assert worker.stats['emails_processed'] == 0

    def test_init_custom_params(self):
        """Test EmailWorker initialization with custom parameters."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            temp_file = f.name

        worker = EmailWorker(
            poll_interval=30,
            processed_ids_file=temp_file,
        )

        assert worker.poll_interval == 30
        assert worker.processed_ids_file == temp_file

    def test_load_processed_ids_empty(self, worker):
        """Test loading when no processed IDs file exists."""
        worker.load_processed_ids()

        assert worker.processed_ids == set()

    def test_load_processed_ids_existing(self, worker):
        """Test loading existing processed IDs from file."""
        # Write some IDs to file
        with open(worker.processed_ids_file, 'w') as f:
            f.write('<id1@example.com>\n')
            f.write('<id2@example.com>\n')
            f.write('<id3@example.com>\n')

        worker.load_processed_ids()

        assert len(worker.processed_ids) == 3
        assert '<id1@example.com>' in worker.processed_ids
        assert '<id2@example.com>' in worker.processed_ids
        assert '<id3@example.com>' in worker.processed_ids

    def test_save_processed_id(self, worker):
        """Test saving a processed Message-ID."""
        worker.save_processed_id('<test@example.com>')

        assert '<test@example.com>' in worker.processed_ids

        # Verify file was updated
        with open(worker.processed_ids_file, 'r') as f:
            content = f.read()
        assert '<test@example.com>' in content

    def test_is_duplicate(self, worker):
        """Test duplicate detection."""
        worker.processed_ids.add('<existing@example.com>')

        assert worker.is_duplicate('<existing@example.com>') is True
        assert worker.is_duplicate('<new@example.com>') is False

    def test_publish_parse_task_success(self, worker, sample_email):
        """Test successful parse_invoice task publication."""
        with patch('backend.tasks.parse_invoice') as mock_task:
            mock_result = Mock()
            mock_result.id = 'task-123'
            mock_task.delay.return_value = mock_result

            result = worker.publish_parse_task(
                filename='invoice.pdf',
                content=b'PDF content',
                metadata={'message_id': '<msg@example.com>'}
            )

            assert result is True
            mock_task.delay.assert_called_once()
            assert worker.stats['tasks_published'] == 1

    def test_publish_parse_task_not_implemented(self, worker):
        """Test handling when parse_invoice task not yet implemented."""
        with patch('backend.tasks.parse_invoice', side_effect=ImportError):
            result = worker.publish_parse_task(
                filename='invoice.pdf',
                content=b'PDF content',
                metadata={}
            )

            # Should return True (mocked success)
            assert result is True
            assert worker.stats['tasks_published'] == 1

    def test_publish_parse_task_failure(self, worker):
        """Test handling parse_invoice task publication failure."""
        with patch('backend.tasks.parse_invoice') as mock_task:
            mock_task.delay.side_effect = Exception('RabbitMQ error')

            result = worker.publish_parse_task(
                filename='invoice.pdf',
                content=b'PDF content',
                metadata={}
            )

            assert result is False
            assert worker.stats['errors'] == 1

    def test_process_email_duplicate(self, worker, sample_email, mock_imap_client):
        """Test skipping already processed email."""
        message_id = '<msg123@example.com>'
        worker.processed_ids.add(message_id)
        mock_imap_client.get_message_id.return_value = message_id

        worker.process_email('123', sample_email, mock_imap_client)

        # Should not process
        assert worker.stats['emails_processed'] == 0
        mock_imap_client.mark_as_read.assert_not_called()

    def test_process_email_no_message_id(self, worker, sample_email, mock_imap_client):
        """Test handling email without Message-ID."""
        mock_imap_client.get_message_id.return_value = ''

        worker.process_email('123', sample_email, mock_imap_client)

        # Should skip without processing
        assert worker.stats['emails_processed'] == 0
        mock_imap_client.mark_as_read.assert_not_called()

    def test_process_email_no_attachments(self, worker, sample_email, mock_imap_client):
        """Test handling email with no supported attachments."""
        mock_imap_client.get_message_id.return_value = '<msg@example.com>'
        mock_imap_client.extract_attachments.return_value = []

        worker.process_email('123', sample_email, mock_imap_client)

        # Should mark as read even without attachments
        mock_imap_client.mark_as_read.assert_called_once_with('123')
        assert '<msg@example.com>' in worker.processed_ids
        # Note: emails_processed is only incremented when attachments are found
        # (see process_email logic - return after warning)
        assert worker.stats['emails_processed'] == 0

    def test_process_email_success(self, worker, sample_email, mock_imap_client):
        """Test successful email processing with attachments."""
        mock_imap_client.get_message_id.return_value = '<msg@example.com>'
        mock_imap_client.extract_attachments.return_value = [
            ('invoice.pdf', b'PDF content', 'application/pdf')
        ]

        with patch('backend.tasks.parse_invoice') as mock_task:
            mock_result = Mock()
            mock_result.id = 'task-123'
            mock_task.delay.return_value = mock_result

            worker.process_email('123', sample_email, mock_imap_client)

            # Should publish task
            mock_task.delay.assert_called_once()
            assert worker.stats['tasks_published'] == 1
            assert worker.stats['attachments_extracted'] == 1
            assert worker.stats['emails_processed'] == 1

            # Should mark as read
            mock_imap_client.mark_as_read.assert_called_once_with('123')

            # Should save Message-ID
            assert '<msg@example.com>' in worker.processed_ids

    def test_process_email_multiple_attachments(self, worker, sample_email, mock_imap_client):
        """Test processing email with multiple attachments."""
        mock_imap_client.get_message_id.return_value = '<msg@example.com>'
        mock_imap_client.extract_attachments.return_value = [
            ('invoice.pdf', b'PDF content', 'application/pdf'),
            (' annex.xlsx', b'Excel content', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        ]

        with patch('backend.tasks.parse_invoice') as mock_task:
            mock_result = Mock()
            mock_result.id = 'task-123'
            mock_task.delay.return_value = mock_result

            worker.process_email('123', sample_email, mock_imap_client)

            # Should publish two tasks
            assert mock_task.delay.call_count == 2
            assert worker.stats['attachments_extracted'] == 2
            assert worker.stats['tasks_published'] == 2

    def test_process_email_extraction_error(self, worker, sample_email, mock_imap_client):
        """Test handling attachment extraction error."""
        mock_imap_client.get_message_id.return_value = '<msg@example.com>'
        mock_imap_client.extract_attachments.side_effect = Exception('Extraction failed')

        worker.process_email('123', sample_email, mock_imap_client)

        # Should increment error count
        assert worker.stats['errors'] == 1

    def test_poll_once_no_emails(self, worker, mock_imap_client):
        """Test poll when no new emails."""
        with patch('backend.email_worker.create_imap_client_from_env') as mock_create:
            mock_create.return_value.__enter__.return_value = mock_imap_client

            worker.poll_once()

            # Should fetch emails
            mock_imap_client.fetch_unread_emails.assert_called_once()

    def test_poll_once_with_emails(self, worker, mock_imap_client, sample_email):
        """Test successful poll with new emails."""
        mock_imap_client.fetch_unread_emails.return_value = [('123', sample_email)]
        mock_imap_client.get_message_id.return_value = '<msg@example.com>'
        mock_imap_client.extract_attachments.return_value = [
            ('invoice.pdf', b'PDF content', 'application/pdf')
        ]

        with patch('backend.email_worker.create_imap_client_from_env') as mock_create:
            mock_create.return_value.__enter__.return_value = mock_imap_client
            with patch('backend.tasks.parse_invoice') as mock_task:
                mock_result = Mock()
                mock_result.id = 'task-123'
                mock_task.delay.return_value = mock_result

                worker.poll_once()

                # Should process email
                assert worker.stats['emails_processed'] == 1

    def test_poll_once_imap_error(self, worker, mock_imap_client):
        """Test handling IMAP error during poll."""
        with patch('backend.email_worker.create_imap_client_from_env') as mock_create:
            mock_create.side_effect = Exception('Connection failed')

            worker.poll_once()

            # Should increment error count
            assert worker.stats['errors'] == 1

    def test_print_stats(self, worker):
        """Test statistics printing."""
        worker.stats['emails_processed'] = 10
        worker.stats['attachments_extracted'] = 15
        worker.stats['tasks_published'] = 15
        worker.stats['errors'] = 2
        worker.stats['started_at'] = __import__('datetime').datetime.now()

        # Should not raise exception
        worker.print_stats()

    def test_handle_shutdown(self, worker):
        """Test shutdown signal handler."""
        worker._handle_shutdown(signal.SIGTERM, None)

        assert worker.shutdown_requested is True
        assert worker.running is False

    def test_poll_forever_shutdown_requested(self, worker, mock_imap_client):
        """Test polling loop respects shutdown request."""
        mock_imap_client.fetch_unread_emails.return_value = []

        with patch('backend.email_worker.create_imap_client_from_env') as mock_create:
            mock_create.return_value.__enter__.return_value = mock_imap_client
            with patch('backend.email_worker.time.sleep'):  # Avoid actual sleep
                # Set shutdown before loop starts
                worker.shutdown_requested = True

                worker.poll_forever()

                # Should exit immediately (shutdown_requested is still True)
                assert worker.shutdown_requested is True


class TestMain:
    """Tests for main entry point."""

    @pytest.fixture
    def env_vars(self):
        """Default environment variables."""
        return {
            'EMAIL_WORKER_POLL_INTERVAL': '30',
            'EMAIL_WORKER_PROCESSED_IDS_FILE': '/tmp/test_ids.txt',
        }

    def test_main_creates_worker(self, env_vars, monkeypatch):
        """Test main creates worker with correct config."""
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        with patch('backend.email_worker.EmailWorker') as mock_worker_class:
            mock_worker = Mock()
            mock_worker_class.return_value = mock_worker

            # Mock poll_forever to avoid infinite loop
            mock_worker.poll_forever.side_effect = SystemExit

            with pytest.raises(SystemExit):
                from backend.email_worker import main
                main()

            # Verify worker created with env config
            mock_worker_class.assert_called_once()
            call_kwargs = mock_worker_class.call_args[1]
            assert call_kwargs['poll_interval'] == 30
            assert call_kwargs['processed_ids_file'] == '/tmp/test_ids.txt'
            mock_worker.poll_forever.assert_called_once()

    def test_main_defaults(self, monkeypatch):
        """Test main uses default values when env vars not set."""
        # Clear env vars
        for key in ['EMAIL_WORKER_POLL_INTERVAL', 'EMAIL_WORKER_PROCESSED_IDS_FILE']:
            monkeypatch.delenv(key, raising=False)

        with patch('backend.email_worker.EmailWorker') as mock_worker_class:
            mock_worker = Mock()
            mock_worker_class.return_value = mock_worker
            mock_worker.poll_forever.side_effect = SystemExit

            with pytest.raises(SystemExit):
                from backend.email_worker import main
                main()

            call_kwargs = mock_worker_class.call_args[1]
            assert call_kwargs['poll_interval'] == 60  # default
            assert '/data/processed_message_ids.txt' in call_kwargs['processed_ids_file']

    def test_main_fatal_error(self, monkeypatch):
        """Test main exits on fatal error."""
        monkeypatch.delenv('EMAIL_WORKER_POLL_INTERVAL', raising=False)

        with patch('backend.email_worker.EmailWorker') as mock_worker_class:
            # Simulate fatal error in poll_forever
            mock_worker_class.return_value.poll_forever.side_effect = Exception('Fatal error')

            with pytest.raises(SystemExit) as exc_info:
                from backend.email_worker import main
                main()

            assert exc_info.value.code == 1
