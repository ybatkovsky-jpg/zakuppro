"""
Unit tests for IMAP Client Module
"""

import pytest
from unittest.mock import Mock, MagicMock, patch, call
from email.message import Message
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import imaplib
import ssl

from services.imap_client import (
    IMAPClient,
    IMAPError,
    IMAPConnectionError,
    IMAPAuthenticationError,
    AttachmentExtractor,
    create_imap_client_from_env,
)


class TestAttachmentExtractor:
    """Tests for AttachmentExtractor class."""

    def test_is_supported_file_pdf(self):
        """Test PDF file is supported."""
        assert AttachmentExtractor.is_supported_file('invoice.pdf') is True

    def test_is_supported_file_excel(self):
        """Test Excel files are supported."""
        assert AttachmentExtractor.is_supported_file('data.xlsx') is True
        assert AttachmentExtractor.is_supported_file('report.xls') is True
        assert AttachmentExtractor.is_supported_file('macro.xlsm') is True

    def test_is_supported_file_unsupported(self):
        """Test unsupported files return False."""
        assert AttachmentExtractor.is_supported_file('image.jpg') is False
        assert AttachmentExtractor.is_supported_file('text.txt') is False
        assert AttachmentExtractor.is_supported_file('archive.zip') is False

    def test_extract_attachments_pdf(self):
        """Test extracting PDF attachment from email."""
        # Create test email with PDF attachment
        message = MIMEMultipart()
        message['Subject'] = 'Test Invoice'
        message['Message-ID'] = '<test@example.com>'

        pdf_part = MIMEApplication(b'%PDF-1.4 test content', _subtype='pdf')
        pdf_part.add_header('Content-Disposition', 'attachment; filename="invoice.pdf"')
        message.attach(pdf_part)

        # Extract attachments
        attachments = AttachmentExtractor.extract_attachments(message)

        assert len(attachments) == 1
        filename, content, content_type = attachments[0]
        assert filename == 'invoice.pdf'
        assert content == b'%PDF-1.4 test content'
        assert 'pdf' in content_type

    def test_extract_attachments_excel(self):
        """Test extracting Excel attachment from email."""
        message = MIMEMultipart()

        excel_part = MIMEApplication(b'PK\x03\x04 excel content', _subtype='xlsx')
        excel_part.add_header('Content-Disposition', 'attachment; filename="data.xlsx"')
        message.attach(excel_part)

        attachments = AttachmentExtractor.extract_attachments(message)

        assert len(attachments) == 1
        assert attachments[0][0] == 'data.xlsx'

    def test_extract_attachments_mixed(self):
        """Test extracting only supported files from mixed attachments."""
        message = MIMEMultipart()

        # Supported PDF
        pdf_part = MIMEApplication(b'PDF content', _subtype='pdf')
        pdf_part.add_header('Content-Disposition', 'attachment; filename="invoice.pdf"')
        message.attach(pdf_part)

        # Unsupported image
        img_part = MIMEApplication(b'JPG content', _subtype='jpg')
        img_part.add_header('Content-Disposition', 'attachment; filename="photo.jpg"')
        message.attach(img_part)

        # Supported Excel
        excel_part = MIMEApplication(b'Excel content', _subtype='xlsx')
        excel_part.add_header('Content-Disposition', 'attachment; filename="data.xlsx"')
        message.attach(excel_part)

        attachments = AttachmentExtractor.extract_attachments(message)

        assert len(attachments) == 2
        filenames = [a[0] for a in attachments]
        assert 'invoice.pdf' in filenames
        assert 'data.xlsx' in filenames
        assert 'photo.jpg' not in filenames

    def test_extract_attachments_no_filename(self):
        """Test attachment without filename is skipped."""
        message = MIMEMultipart()

        part = MIMEApplication(b'content', _subtype='pdf')
        part.add_header('Content-Disposition', 'attachment')
        message.attach(part)

        attachments = AttachmentExtractor.extract_attachments(message)
        assert len(attachments) == 0

    def test_extract_attachments_empty_email(self):
        """Test email with no attachments returns empty list."""
        message = Message()
        message['Subject'] = 'No attachments'

        attachments = AttachmentExtractor.extract_attachments(message)
        assert len(attachments) == 0


class TestIMAPClient:
    """Tests for IMAPClient class."""

    @pytest.fixture
    def client(self):
        """Create test IMAPClient instance."""
        return IMAPClient(
            host='imap.example.com',
            port=993,
            username='test@example.com',
            password='testpass',
            use_ssl=True,
        )

    @pytest.fixture
    def mock_connection(self):
        """Create mock IMAP connection."""
        conn = Mock(spec=imaplib.IMAP4_SSL)
        conn.login.return_value = ('OK', [])
        conn.select.return_value = ('OK', [])
        conn.search.return_value = ('OK', [b''])
        conn.fetch.return_value = ('OK', [])
        conn.store.return_value = ('OK', [])
        return conn

    def test_init_defaults(self):
        """Test IMAPClient initialization with defaults."""
        client = IMAPClient(host='imap.example.com')
        assert client.host == 'imap.example.com'
        assert client.port == 993
        assert client.use_ssl is True
        assert client.folder == 'INBOX'
        assert client.max_retries == 3
        assert client.retry_delay == 1

    def test_init_custom_params(self):
        """Test IMAPClient initialization with custom parameters."""
        client = IMAPClient(
            host='imap.example.com',
            port=143,
            username='user',
            password='pass',
            use_ssl=False,
            folder='Archive',
            max_retries=5,
            retry_delay=2,
        )
        assert client.port == 143
        assert client.use_ssl is False
        assert client.folder == 'Archive'
        assert client.max_retries == 5
        assert client.retry_delay == 2

    def test_connect_success(self, client, mock_connection):
        """Test successful IMAP connection."""
        with patch.object(IMAPClient, '_create_connection', return_value=mock_connection):
            result = client.connect()

            assert result is True
            assert client._is_connected is True
            mock_connection.login.assert_called_once_with('test@example.com', 'testpass')
            mock_connection.select.assert_called_once_with('INBOX')

    def test_connect_already_connected(self, client, mock_connection):
        """Test connecting when already connected returns True."""
        client._is_connected = True
        client.connection = mock_connection

        result = client.connect()
        assert result is True
        mock_connection.login.assert_not_called()

    def test_connect_authentication_error(self, client):
        """Test authentication error raises IMAPAuthenticationError."""
        mock_conn = Mock()
        # Use actual IMAP4.error with string containing 'authentication failed'
        mock_conn.login.side_effect = imaplib.IMAP4.error('authentication failed')

        with patch.object(IMAPClient, '_create_connection', return_value=mock_conn):
            with pytest.raises(IMAPAuthenticationError):
                client.connect()

    def test_connect_retry_on_failure(self, client):
        """Test connection retry with exponential backoff."""
        mock_conn = Mock()
        mock_conn.login.side_effect = [imaplib.IMAP4.error('Temporary failure'), ('OK', [])]

        with patch.object(IMAPClient, '_create_connection', return_value=mock_conn):
            with patch('services.imap_client.time.sleep') as mock_sleep:
                result = client.connect()

                assert result is True
                assert mock_conn.login.call_count == 2
                mock_sleep.assert_called_once()

    def test_connect_max_retries_exceeded(self, client):
        """Test connection failure after max retries."""
        mock_conn = Mock()
        mock_conn.login.side_effect = imaplib.IMAP4.error('Connection failed')

        with patch.object(IMAPClient, '_create_connection', return_value=mock_conn):
            with pytest.raises(IMAPConnectionError) as exc_info:
                client.connect()

            assert 'Failed to connect' in str(exc_info.value)
            assert mock_conn.login.call_count == 3  # max_retries = 3

    def test_disconnect(self, client, mock_connection):
        """Test disconnect closes connection gracefully."""
        client.connection = mock_connection
        client._is_connected = True

        client.disconnect()

        mock_connection.close.assert_called_once()
        mock_connection.logout.assert_called_once()
        assert client._is_connected is False

    def test_disconnect_with_error(self, client, mock_connection):
        """Test disconnect handles errors gracefully."""
        mock_connection.close.side_effect = Exception('Connection already closed')
        client.connection = mock_connection
        client._is_connected = True

        # Should not raise exception
        client.disconnect()

        assert client._is_connected is False

    def test_context_manager(self, client, mock_connection):
        """Test using IMAPClient as context manager."""
        with patch.object(IMAPClient, '_create_connection', return_value=mock_connection):
            with client:
                assert client._is_connected is True

            assert client._is_connected is False
            mock_connection.close.assert_called_once()
            mock_connection.logout.assert_called_once()

    def test_fetch_unread_emails_no_emails(self, client, mock_connection):
        """Test fetching when no unread emails."""
        mock_connection.search.return_value = ('OK', [b''])
        client.connection = mock_connection
        client._is_connected = True

        emails = client.fetch_unread_emails()

        assert emails == []

    def test_fetch_unread_emails_success(self, client, mock_connection):
        """Test successful fetching of unread emails."""
        # Mock search returning 1 email
        mock_connection.search.return_value = ('OK', [b'101'])

        # Mock fetch returning email data
        from email.message import Message
        msg1 = Message()
        msg1['Subject'] = 'Invoice 1'
        msg1['Message-ID'] = '<msg1@example.com>'
        msg1.set_payload('Email 1 content')

        raw_email1 = msg1.as_bytes()

        mock_connection.fetch.return_value = ('OK', [(b'101 (RFC822 {len}', raw_email1), b')'])

        client.connection = mock_connection
        client._is_connected = True

        emails = client.fetch_unread_emails()

        assert len(emails) == 1
        uid, message = emails[0]
        assert uid == '101'
        assert message['Subject'] == 'Invoice 1'

    def test_fetch_unread_emails_search_failure(self, client, mock_connection):
        """Test fetch when IMAP search fails."""
        mock_connection.search.return_value = ('NO', [b'Search failed'])
        client.connection = mock_connection
        client._is_connected = True

        with pytest.raises(IMAPError) as exc_info:
            client.fetch_unread_emails()

        assert 'IMAP search failed' in str(exc_info.value)

    def test_mark_as_read_success(self, client, mock_connection):
        """Test marking email as read."""
        mock_connection.store.return_value = ('OK', [])
        client.connection = mock_connection
        client._is_connected = True

        result = client.mark_as_read('123')

        assert result is True
        mock_connection.store.assert_called_once_with('123', '+FLAGS', '\\Seen')

    def test_mark_as_read_failure(self, client, mock_connection):
        """Test mark as read when store fails."""
        mock_connection.store.return_value = ('NO', [b'Failed'])
        client.connection = mock_connection
        client._is_connected = True

        result = client.mark_as_read('123')

        assert result is False

    def test_get_message_id(self, client):
        """Test extracting Message-ID from email."""
        message = Message()
        message['Message-ID'] = '<test@example.com>'

        result = client.get_message_id(message)

        assert result == '<test@example.com>'

    def test_get_message_id_missing(self, client):
        """Test get_message_id when header is missing."""
        message = Message()

        result = client.get_message_id(message)

        assert result == ''

    def test_extract_attachments_delegates(self, client):
        """Test extract_attachments delegates to AttachmentExtractor."""
        message = Message()

        with patch('services.imap_client.AttachmentExtractor.extract_attachments') as mock_extract:
            mock_extract.return_value = [('file.pdf', b'content', 'application/pdf')]
            client.connection = Mock()
            client._is_connected = True

            result = client.extract_attachments(message)

            mock_extract.assert_called_once_with(message)
            assert result == [('file.pdf', b'content', 'application/pdf')]

    def test_ensure_connected_reconnects(self, client, mock_connection):
        """Test _ensure_connected reconnects if disconnected."""
        client.connection = None
        client._is_connected = False

        with patch.object(client, 'connect') as mock_connect:
            client._ensure_connected()
            mock_connect.assert_called_once()

    def test_create_connection_ssl(self, client):
        """Test SSL connection creation."""
        with patch('services.imap_client.ssl.create_default_context') as mock_context:
            with patch('services.imap_client.imaplib.IMAP4_SSL') as mock_imap:
                client._create_connection()

                mock_context.assert_called_once()
                mock_imap.assert_called_once()

    def test_create_connection_non_ssl(self, client):
        """Test non-SSL connection creation."""
        client.use_ssl = False

        with patch('services.imap_client.imaplib.IMAP4') as mock_imap:
            client._create_connection()

            mock_imap.assert_called_once_with('imap.example.com', 993)


class TestCreateImapClientFromEnv:
    """Tests for create_imap_client_from_env function."""

    @pytest.fixture
    def env_vars(self):
        """Required environment variables."""
        return {
            'IMAP_HOST': 'imap.example.com',
            'IMAP_PORT': '993',
            'IMAP_USER': 'user@example.com',
            'IMAP_PASS': 'password',
            'IMAP_USE_SSL': 'true',
            'IMAP_FOLDER': 'INBOX',
            'IMAP_MAX_RETRIES': '3',
            'IMAP_RETRY_DELAY': '1',
        }

    def test_create_from_env_success(self, env_vars, monkeypatch):
        """Test successful creation from environment."""
        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        client = create_imap_client_from_env()

        assert client.host == 'imap.example.com'
        assert client.port == 993
        assert client.username == 'user@example.com'
        assert client.password == 'password'
        assert client.use_ssl is True

    def test_create_from_env_defaults(self, monkeypatch):
        """Test creation with default values."""
        monkeypatch.setenv('IMAP_HOST', 'imap.example.com')
        monkeypatch.setenv('IMAP_USER', 'user')
        monkeypatch.setenv('IMAP_PASS', 'pass')

        client = create_imap_client_from_env()

        assert client.port == 993
        assert client.use_ssl is True
        assert client.folder == 'INBOX'
        assert client.max_retries == 3
        assert client.retry_delay == 1

    def test_create_from_env_missing_host(self, monkeypatch):
        """Test missing IMAP_HOST raises ValueError."""
        monkeypatch.delenv('IMAP_HOST', raising=False)
        monkeypatch.setenv('IMAP_USER', 'user')
        monkeypatch.setenv('IMAP_PASS', 'pass')

        with pytest.raises(ValueError) as exc_info:
            create_imap_client_from_env()

        assert 'IMAP_HOST' in str(exc_info.value)

    def test_create_from_env_missing_user(self, monkeypatch):
        """Test missing IMAP_USER raises ValueError."""
        monkeypatch.delenv('IMAP_USER', raising=False)
        monkeypatch.setenv('IMAP_HOST', 'imap.example.com')
        monkeypatch.setenv('IMAP_PASS', 'pass')

        with pytest.raises(ValueError) as exc_info:
            create_imap_client_from_env()

        assert 'IMAP_USER' in str(exc_info.value)

    def test_create_from_env_missing_password(self, monkeypatch):
        """Test missing IMAP_PASS raises ValueError."""
        monkeypatch.delenv('IMAP_PASS', raising=False)
        monkeypatch.setenv('IMAP_HOST', 'imap.example.com')
        monkeypatch.setenv('IMAP_USER', 'user')

        with pytest.raises(ValueError) as exc_info:
            create_imap_client_from_env()

        assert 'IMAP_PASS' in str(exc_info.value)

    def test_create_from_env_custom_values(self, env_vars, monkeypatch):
        """Test creation with custom environment values."""
        env_vars['IMAP_PORT'] = '143'
        env_vars['IMAP_USE_SSL'] = 'false'
        env_vars['IMAP_FOLDER'] = 'Archive'
        env_vars['IMAP_MAX_RETRIES'] = '5'
        env_vars['IMAP_RETRY_DELAY'] = '2'

        for key, value in env_vars.items():
            monkeypatch.setenv(key, value)

        client = create_imap_client_from_env()

        assert client.port == 143
        assert client.use_ssl is False
        assert client.folder == 'Archive'
        assert client.max_retries == 5
        assert client.retry_delay == 2
