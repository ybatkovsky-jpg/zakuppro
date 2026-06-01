"""
Unit tests for Email notification functions.
"""

import pytest
import os
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from email.message import EmailMessage

# Handle optional aiosmtplib import
try:
    import aiosmtplib
    from aiosmtplib import SMTPException
    SMTP_AVAILABLE = True
except ImportError:
    SMTP_AVAILABLE = False
    SMTPException = Exception

from backend.email_notifier import (
    send_clarification_email,
    send_test_email,
    _check_smtp_config,
    _build_clarification_email,
)


@pytest.mark.skipif(not SMTP_AVAILABLE, reason='aiosmtplib not available')
class TestCheckSmtpConfig:
    """Tests for _check_smtp_config function."""

    def test_check_smtp_config_all_present(self):
        """Test config check with all required env vars."""
        # Save original values
        orig_host = os.getenv('SMTP_HOST')
        orig_email = os.getenv('SMTP_EMAIL')
        orig_pass = os.getenv('SMTP_PASSWORD')

        try:
            os.environ['SMTP_HOST'] = 'smtp.example.com'
            os.environ['SMTP_EMAIL'] = 'test@example.com'
            os.environ['SMTP_PASSWORD'] = 'pass'

            # Reload the module to pick up new env vars
            import importlib
            import backend.email_notifier
            importlib.reload(backend.email_notifier)

            from backend.email_notifier import _check_smtp_config
            result = _check_smtp_config()
            assert result is True
        finally:
            # Restore original values
            if orig_host is not None:
                os.environ['SMTP_HOST'] = orig_host
            else:
                os.environ.pop('SMTP_HOST', None)
            if orig_email is not None:
                os.environ['SMTP_EMAIL'] = orig_email
            else:
                os.environ.pop('SMTP_EMAIL', None)
            if orig_pass is not None:
                os.environ['SMTP_PASSWORD'] = orig_pass
            else:
                os.environ.pop('SMTP_PASSWORD', None)
            importlib.reload(backend.email_notifier)

    def test_check_smtp_config_missing_host(self):
        """Test config check with missing SMTP_HOST."""
        # Save original values
        orig_host = os.getenv('SMTP_HOST')
        orig_email = os.getenv('SMTP_EMAIL')
        orig_pass = os.getenv('SMTP_PASSWORD')

        try:
            os.environ.pop('SMTP_HOST', None)
            os.environ['SMTP_EMAIL'] = 'test@example.com'
            os.environ['SMTP_PASSWORD'] = 'pass'

            # Reload the module to pick up new env vars
            import importlib
            import backend.email_notifier
            importlib.reload(backend.email_notifier)

            from backend.email_notifier import _check_smtp_config
            result = _check_smtp_config()
            assert result is False
        finally:
            # Restore original values
            if orig_host is not None:
                os.environ['SMTP_HOST'] = orig_host
            if orig_email is not None:
                os.environ['SMTP_EMAIL'] = orig_email
            else:
                os.environ.pop('SMTP_EMAIL', None)
            if orig_pass is not None:
                os.environ['SMTP_PASSWORD'] = orig_pass
            else:
                os.environ.pop('SMTP_PASSWORD', None)
            importlib.reload(backend.email_notifier)

    def test_check_smtp_config_missing_email(self):
        """Test config check with missing SMTP_EMAIL."""
        # Save original values
        orig_host = os.getenv('SMTP_HOST')
        orig_email = os.getenv('SMTP_EMAIL')
        orig_pass = os.getenv('SMTP_PASSWORD')

        try:
            os.environ['SMTP_HOST'] = 'smtp.example.com'
            os.environ.pop('SMTP_EMAIL', None)
            os.environ['SMTP_PASSWORD'] = 'pass'

            # Reload the module to pick up new env vars
            import importlib
            import backend.email_notifier
            importlib.reload(backend.email_notifier)

            from backend.email_notifier import _check_smtp_config
            result = _check_smtp_config()
            assert result is False
        finally:
            # Restore original values
            if orig_host is not None:
                os.environ['SMTP_HOST'] = orig_host
            if orig_email is not None:
                os.environ['SMTP_EMAIL'] = orig_email
            if orig_pass is not None:
                os.environ['SMTP_PASSWORD'] = orig_pass
            else:
                os.environ.pop('SMTP_PASSWORD', None)
            importlib.reload(backend.email_notifier)

    def test_check_smtp_config_library_unavailable(self):
        """Test config check when aiosmtplib is not available."""
        with patch('backend.email_notifier.SMTP_AVAILABLE', False):
            result = _check_smtp_config()
            assert result is False


@pytest.mark.skipif(not SMTP_AVAILABLE, reason='aiosmtplib not available')
class TestBuildClarificationEmail:
    """Tests for _build_clarification_email function."""

    def test_build_email_basic(self):
        """Test basic email building with required fields."""
        with patch('backend.email_notifier.SMTP_FROM_NAME', 'ZakupPro'):
            with patch('backend.email_notifier.SMTP_EMAIL', 'noreply@zakuppro.ru'):
                msg = _build_clarification_email(
                    supplier_email='supplier@example.com',
                    supplier_name='Supplier LLC',
                    invoice_number='INV-123',
                    unmatched_items=[]
                )

                assert isinstance(msg, EmailMessage)
                assert 'supplier@example.com' in msg['To']
                assert 'noreply@zakuppro.ru' in msg['From']
                assert 'INV-123' in msg['Subject']

    def test_build_email_with_unmatched_items(self):
        """Test email building includes unmatched items details."""
        unmatched_items = [
            {
                'invoice_item': {'name': 'Widget A', 'quantity': 10, 'price': '100.50'},
                'expected_item': {'name': 'Widget A Pro'},
                'confidence': 0.85
            }
        ]

        with patch('backend.email_notifier.SMTP_FROM_NAME', 'ZakupPro'):
            with patch('backend.email_notifier.SMTP_EMAIL', 'noreply@zakuppro.ru'):
                msg = _build_clarification_email(
                    supplier_email='supplier@example.com',
                    supplier_name='Supplier LLC',
                    invoice_number='INV-123',
                    unmatched_items=unmatched_items
                )

                body = msg.get_content()
                assert 'Widget A' in body
                assert 'Widget A Pro' in body
                assert '85%' in body
                assert '10' in body
                assert '100.50' in body

    def test_build_email_truncates_long_list(self):
        """Test that long unmatched item lists are truncated."""
        unmatched_items = [
            {
                'invoice_item': {'name': f'Item {i}', 'quantity': i, 'price': '10.00'},
                'expected_item': {'name': f'Expected {i}'},
                'confidence': 0.8
            }
            for i in range(15)
        ]

        with patch('backend.email_notifier.SMTP_FROM_NAME', 'ZakupPro'):
            with patch('backend.email_notifier.SMTP_EMAIL', 'noreply@zakuppro.ru'):
                msg = _build_clarification_email(
                    supplier_email='supplier@example.com',
                    supplier_name='Supplier LLC',
                    invoice_number='INV-123',
                    unmatched_items=unmatched_items
                )

                body = msg.get_content()
                assert 'Item 0' in body
                assert 'еще 5' in body

    def test_build_email_without_supplier_name(self):
        """Test email greeting when supplier name not provided."""
        with patch('backend.email_notifier.SMTP_FROM_NAME', 'ZakupPro'):
            with patch('backend.email_notifier.SMTP_EMAIL', 'noreply@zakuppro.ru'):
                msg = _build_clarification_email(
                    supplier_email='supplier@example.com',
                    supplier_name=None,
                    invoice_number='INV-123',
                    unmatched_items=[]
                )

                body = msg.get_content()
                assert 'партнер' in body


@pytest.mark.skipif(not SMTP_AVAILABLE, reason='aiosmtplib not available')
class TestSendClarificationEmail:
    """Tests for send_clarification_email function."""

    @pytest.fixture
    def mock_smtp(self):
        """Create mock SMTP client."""
        smtp = AsyncMock()
        smtp.__aenter__ = AsyncMock(return_value=smtp)
        smtp.__aexit__ = AsyncMock()
        smtp.login = AsyncMock()
        smtp.send_message = AsyncMock()
        return smtp

    @pytest.mark.asyncio
    async def test_send_clarification_success(self, mock_smtp):
        """Test successful clarification email sending."""
        unmatched_items = [
            {
                'invoice_item': {'name': 'Widget A', 'quantity': 5},
                'expected_item': {'name': 'Widget A'},
                'confidence': 0.9
            }
        ]

        with patch('backend.email_notifier._check_smtp_config', return_value=True):
            with patch('aiosmtplib.SMTP', return_value=mock_smtp):
                result = await send_clarification_email(
                    supplier_email='supplier@example.com',
                    invoice_number='INV-123',
                    supplier_name='Test Supplier',
                    unmatched_items=unmatched_items
                )

        assert result is True
        mock_smtp.login.assert_called_once()
        mock_smtp.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_clarification_no_config(self):
        """Test clarification email with missing SMTP config."""
        with patch('backend.email_notifier._check_smtp_config', return_value=False):
            result = await send_clarification_email(
                supplier_email='supplier@example.com',
                invoice_number='INV-123'
            )

        assert result is False

    @pytest.mark.asyncio
    async def test_send_clarification_smtp_error(self):
        """Test handling SMTP error during send."""
        # Create a mock SMTP client that raises error on login
        class FailingSMTP:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def login(self, *args, **kwargs):
                raise SMTPException('Auth failed')

            async def send_message(self, *args, **kwargs):
                pass

        with patch('backend.email_notifier._check_smtp_config', return_value=True):
            with patch('aiosmtplib.SMTP', return_value=FailingSMTP()):
                result = await send_clarification_email(
                    supplier_email='supplier@example.com',
                    invoice_number='INV-123'
                )

        assert result is False

    @pytest.mark.asyncio
    async def test_send_clarification_unexpected_error(self):
        """Test handling unexpected error during send."""
        # Create a mock SMTP client that raises error on login
        class FailingSMTP:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def login(self, *args, **kwargs):
                raise Exception('Connection timeout')

            async def send_message(self, *args, **kwargs):
                pass

        with patch('backend.email_notifier._check_smtp_config', return_value=True):
            with patch('aiosmtplib.SMTP', return_value=FailingSMTP()):
                result = await send_clarification_email(
                    supplier_email='supplier@example.com',
                    invoice_number='INV-123'
                )

        assert result is False

    @pytest.mark.asyncio
    async def test_send_clarification_empty_items(self, mock_smtp):
        """Test clarification email with no unmatched items."""
        with patch('backend.email_notifier._check_smtp_config', return_value=True):
            with patch('aiosmtplib.SMTP', return_value=mock_smtp):
                result = await send_clarification_email(
                    supplier_email='supplier@example.com',
                    invoice_number='INV-123',
                    unmatched_items=[]
                )

        assert result is True
        mock_smtp.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_clarification_none_items(self, mock_smtp):
        """Test clarification email with None items (defaults to empty list)."""
        with patch('backend.email_notifier._check_smtp_config', return_value=True):
            with patch('aiosmtplib.SMTP', return_value=mock_smtp):
                result = await send_clarification_email(
                    supplier_email='supplier@example.com',
                    invoice_number='INV-123',
                    unmatched_items=None
                )

        assert result is True
        mock_smtp.send_message.assert_called_once()


@pytest.mark.skipif(not SMTP_AVAILABLE, reason='aiosmtplib not available')
class TestSendTestEmail:
    """Tests for send_test_email function."""

    @pytest.fixture
    def mock_smtp(self):
        """Create mock SMTP client."""
        smtp = AsyncMock()
        smtp.__aenter__ = AsyncMock(return_value=smtp)
        smtp.__aexit__ = AsyncMock()
        smtp.login = AsyncMock()
        smtp.send_message = AsyncMock()
        return smtp

    @pytest.mark.asyncio
    async def test_send_test_email_success(self, mock_smtp):
        """Test successful test email sending."""
        with patch('backend.email_notifier._check_smtp_config', return_value=True):
            with patch('aiosmtplib.SMTP', return_value=mock_smtp):
                result = await send_test_email('test@example.com')

        assert result is True
        mock_smtp.login.assert_called_once()
        mock_smtp.send_message.assert_called_once()
        # Verify email content
        sent_msg = mock_smtp.send_message.call_args[0][0]
        assert 'Тестовое письмо' in sent_msg['Subject']

    @pytest.mark.asyncio
    async def test_send_test_email_no_config(self):
        """Test test email with missing SMTP config."""
        with patch('backend.email_notifier._check_smtp_config', return_value=False):
            result = await send_test_email('test@example.com')

        assert result is False

    @pytest.mark.asyncio
    async def test_send_test_email_smtp_error(self):
        """Test handling SMTP error during test email send."""
        # Create a mock SMTP client that raises error on send_message
        class FailingSMTP:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *args):
                pass

            async def login(self, *args, **kwargs):
                pass

            async def send_message(self, *args, **kwargs):
                raise SMTPException('Send failed')

        with patch('backend.email_notifier._check_smtp_config', return_value=True):
            with patch('aiosmtplib.SMTP', return_value=FailingSMTP()):
                result = await send_test_email('test@example.com')

        assert result is False


@pytest.mark.skipif(not SMTP_AVAILABLE, reason='aiosmtplib not available')
class TestEmailContent:
    """Tests for email message content and formatting."""

    def test_email_in_russian(self):
        """Test that clarification email content is in Russian."""
        with patch('backend.email_notifier.SMTP_FROM_NAME', 'ZakupPro'):
            with patch('backend.email_notifier.SMTP_EMAIL', 'noreply@zakuppro.ru'):
                msg = _build_clarification_email(
                    supplier_email='supplier@example.com',
                    supplier_name='Test',
                    invoice_number='INV-001',
                    unmatched_items=[]
                )

                body = msg.get_content()
                # Russian text verification
                assert 'Уважаемый' in body
                assert 'счету' in body
                assert 'Просим подтвердить' in body
                assert 'С уважением' in body

    def test_email_request_confirmation(self):
        """Test that email requests confirmation from supplier."""
        with patch('backend.email_notifier.SMTP_FROM_NAME', 'ZakupPro'):
            with patch('backend.email_notifier.SMTP_EMAIL', 'noreply@zakuppro.ru'):
                msg = _build_clarification_email(
                    supplier_email='supplier@example.com',
                    supplier_name='Test',
                    invoice_number='INV-001',
                    unmatched_items=[{
                        'invoice_item': {'name': 'Item X'},
                        'expected_item': {'name': 'Item Y'},
                        'confidence': 0.75
                    }]
                )

                body = msg.get_content()
                assert 'подтвердить' in body
                assert 'точность' in body or 'Точность' in body
