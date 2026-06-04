"""
Unit tests for Telegram notification functions.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock, call

# Handle optional telegram import
try:
    from telegram.error import TelegramError
except ImportError:
    TelegramError = Exception

from backend.telegram_notifier import (
    send_completion_message,
    send_invoice_verified,
    send_invoice_partial,
    send_invoice_clarification_needed,
    send_invoice_failed,
)


class TestSendInvoiceVerified:
    """Tests for send_invoice_verified function."""

    @pytest.fixture
    def mock_bot(self):
        """Create mock Bot instance."""
        bot = Mock()
        bot.send_message.return_value = None
        return bot

    def test_send_invoice_verified_success(self, mock_bot):
        """Test successful invoice verified notification."""
        chat_id = 123456
        invoice_id = 100
        stats = {'matched': 5, 'total': 5, 'confidence': 0.95}

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_verified(chat_id, invoice_id, stats)

        assert result is True
        mock_bot.send_message.assert_called_once()
        call_args = mock_bot.send_message.call_args
        assert call_args[1]['chat_id'] == chat_id
        assert '✅' in call_args[1]['text']
        assert str(invoice_id) in call_args[1]['text']
        assert '95.0%' in call_args[1]['text']

    def test_send_invoice_verified_no_confidence(self, mock_bot):
        """Test invoice verified notification without confidence score."""
        chat_id = 123456
        invoice_id = 100
        stats = {'matched': 3, 'total': 3}

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_verified(chat_id, invoice_id, stats)

        assert result is True
        call_args = mock_bot.send_message.call_args
        assert 'Точность' not in call_args[1]['text']

    def test_send_invoice_verified_no_bot(self):
        """Test invoice verified notification when bot unavailable."""
        with patch('backend.telegram_notifier._get_bot', return_value=None):
            result = send_invoice_verified(123456, 100, {'matched': 5, 'total': 5})

        assert result is False

    def test_send_invoice_verified_telegram_error(self, mock_bot):
        """Test handling Telegram API error — retried then returns False."""
        mock_bot.send_message.side_effect = TelegramError('API Error')

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep'):  # Skip retry backoff
                result = send_invoice_verified(123456, 100, {'matched': 5, 'total': 5})

        assert result is False
        assert mock_bot.send_message.call_count == 3

    def test_send_invoice_verified_unexpected_error(self, mock_bot):
        """Test handling unexpected error."""
        mock_bot.send_message.side_effect = Exception('Unexpected error')

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_verified(123456, 100, {'matched': 5, 'total': 5})

        assert result is False


class TestSendInvoicePartial:
    """Tests for send_invoice_partial function."""

    @pytest.fixture
    def mock_bot(self):
        """Create mock Bot instance."""
        bot = Mock()
        bot.send_message.return_value = None
        return bot

    def test_send_invoice_partial_success(self, mock_bot):
        """Test successful invoice partial notification."""
        chat_id = 123456
        invoice_id = 100
        discrepancies = [
            'Item A: expected 10, got 8',
            'Item B: expected 5, got 3'
        ]

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_partial(chat_id, invoice_id, discrepancies)

        assert result is True
        mock_bot.send_message.assert_called_once()
        call_args = mock_bot.send_message.call_args
        assert '⚠️' in call_args[1]['text']
        assert 'Частичное совпадение' in call_args[1]['text']
        assert 'Item A: expected 10, got 8' in call_args[1]['text']

    def test_send_invoice_partial_truncates_list(self, mock_bot):
        """Test that long discrepancy lists are truncated."""
        chat_id = 123456
        invoice_id = 100
        discrepancies = [f'Discrepancy {i}' for i in range(10)]

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_partial(chat_id, invoice_id, discrepancies)

        assert result is True
        call_args = mock_bot.send_message.call_args
        text = call_args[1]['text']
        assert 'Discrepancy 5' not in text  # 6th item not shown
        assert 'еще 5' in text  # Shows "and 5 more"

    def test_send_invoice_partial_no_bot(self):
        """Test invoice partial notification when bot unavailable."""
        with patch('backend.telegram_notifier._get_bot', return_value=None):
            result = send_invoice_partial(123456, 100, ['Discrepancy'])

        assert result is False

    def test_send_invoice_partial_telegram_error(self, mock_bot):
        """Test handling Telegram API error — retried then returns False."""
        mock_bot.send_message.side_effect = TelegramError('API Error')

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep'):  # Skip retry backoff
                result = send_invoice_partial(123456, 100, ['Discrepancy'])

        assert result is False
        assert mock_bot.send_message.call_count == 3


class TestSendInvoiceClarificationNeeded:
    """Tests for send_invoice_clarification_needed function."""

    @pytest.fixture
    def mock_bot(self):
        """Create mock Bot instance."""
        bot = Mock()
        bot.send_message.return_value = None
        return bot

    def test_send_clarification_success(self, mock_bot):
        """Test successful clarification needed notification."""
        chat_id = 123456
        invoice_id = 100
        fuzzy_matches = [
            {'name': 'Product A', 'confidence': 0.85},
            {'name': 'Product B', 'confidence': 0.72}
        ]

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_clarification_needed(chat_id, invoice_id, fuzzy_matches)

        assert result is True
        mock_bot.send_message.assert_called_once()
        call_args = mock_bot.send_message.call_args
        assert '🔔' in call_args[1]['text']
        assert 'Требуется уточнение' in call_args[1]['text']
        assert 'Product A (85%)' in call_args[1]['text']
        assert 'Product B (72%)' in call_args[1]['text']
        assert 'Отправьте письмо поставщику' in call_args[1]['text']

    def test_send_clarification_truncates_list(self, mock_bot):
        """Test that long fuzzy match lists are truncated."""
        chat_id = 123456
        invoice_id = 100
        fuzzy_matches = [
            {'name': f'Product {i}', 'confidence': 0.5}
            for i in range(5)
        ]

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_clarification_needed(chat_id, invoice_id, fuzzy_matches)

        assert result is True
        call_args = mock_bot.send_message.call_args
        text = call_args[1]['text']
        assert 'Product 0' in text
        assert 'Product 2' in text
        assert 'Product 3' not in text  # 4th item not shown
        assert 'еще 2' in text  # Shows "and 2 more"

    def test_send_clarification_no_bot(self):
        """Test clarification notification when bot unavailable."""
        with patch('backend.telegram_notifier._get_bot', return_value=None):
            result = send_invoice_clarification_needed(123456, 100, [])

        assert result is False

    def test_send_clarification_telegram_error(self, mock_bot):
        """Test handling Telegram API error — retried then returns False."""
        mock_bot.send_message.side_effect = TelegramError('API Error')

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep'):  # Skip retry backoff
                result = send_invoice_clarification_needed(123456, 100, [])

        assert result is False
        assert mock_bot.send_message.call_count == 3


class TestSendInvoiceFailed:
    """Tests for send_invoice_failed function."""

    @pytest.fixture
    def mock_bot(self):
        """Create mock Bot instance."""
        bot = Mock()
        bot.send_message.return_value = None
        return bot

    def test_send_invoice_failed_success(self, mock_bot):
        """Test successful invoice failed notification."""
        chat_id = 123456
        invoice_id = 100
        error = 'Failed to parse invoice: invalid format'

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_failed(chat_id, invoice_id, error)

        assert result is True
        mock_bot.send_message.assert_called_once()
        call_args = mock_bot.send_message.call_args
        assert '🚨' in call_args[1]['text']
        assert 'Ошибка сверка счета' in call_args[1]['text']
        assert error in call_args[1]['text']

    def test_send_invoice_failed_no_bot(self):
        """Test invoice failed notification when bot unavailable."""
        with patch('backend.telegram_notifier._get_bot', return_value=None):
            result = send_invoice_failed(123456, 100, 'Error')

        assert result is False

    def test_send_invoice_failed_telegram_error(self, mock_bot):
        """Test handling Telegram API error — retried then returns False."""
        mock_bot.send_message.side_effect = TelegramError('API Error')

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep'):  # Skip retry backoff
                result = send_invoice_failed(123456, 100, 'Error')

        assert result is False
        assert mock_bot.send_message.call_count == 3

    def test_send_invoice_failed_long_error(self, mock_bot):
        """Test invoice failed notification with long error message."""
        chat_id = 123456
        invoice_id = 100
        error = 'A' * 500  # Long error message

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            result = send_invoice_failed(chat_id, invoice_id, error)

        assert result is True
        mock_bot.send_message.assert_called_once()
        call_args = mock_bot.send_message.call_args
        assert error in call_args[1]['text']


class TestTelegramRetry:
    """Tests for retry behavior with @retry_sync decorator on Telegram functions."""

    @pytest.fixture
    def mock_bot(self):
        """Create mock Bot instance."""
        bot = Mock()
        bot.send_message = Mock()
        return bot

    def test_retry_on_telegramerror_then_succeed(self, mock_bot):
        """Telegram fails with TelegramError twice, succeeds on 3rd attempt."""
        mock_bot.send_message.side_effect = [
            TelegramError('Network error'),
            TelegramError('Timeout'),
            None,  # Succeeds on 3rd
        ]

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep'):  # Skip retry backoff
                result = send_completion_message(
                    chat_id=123456,
                    project_name='Test',
                    items_count=10,
                )

        assert result is True
        assert mock_bot.send_message.call_count == 3

    def test_retry_on_telegramerror_all_exhausted(self, mock_bot):
        """Telegram always fails — returns False after 3 attempts."""
        mock_bot.send_message.side_effect = TelegramError('Server unavailable')

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep'):  # Skip retry backoff
                result = send_completion_message(
                    chat_id=123456,
                    project_name='Test',
                    items_count=10,
                )

        assert result is False
        assert mock_bot.send_message.call_count == 3

    def test_no_retry_on_non_telegram_error(self, mock_bot):
        """Non-TelegramError (ValueError) — no retry, returns False immediately."""
        mock_bot.send_message.side_effect = ValueError('Unexpected error')

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep') as mock_sleep:
                result = send_completion_message(
                    chat_id=123456,
                    project_name='Test',
                    items_count=10,
                )

        assert result is False
        mock_sleep.assert_not_called()  # No retry = no sleep
        mock_bot.send_message.assert_called_once()

    def test_no_retry_when_bot_unavailable(self):
        """_get_bot returns None → False immediately, 0 retries."""
        with patch('backend.telegram_notifier._get_bot', return_value=None):
            with patch('time.sleep') as mock_sleep:
                result = send_completion_message(
                    chat_id=123456,
                    project_name='Test',
                    items_count=10,
                )

        assert result is False
        mock_sleep.assert_not_called()

    def test_retry_attempt_count(self, mock_bot):
        """send_message called exactly 3 times when first 2 fail with TelegramError."""
        mock_bot.send_message.side_effect = [
            TelegramError('Attempt 1 fail'),
            TelegramError('Attempt 2 fail'),
            None,  # 3rd succeeds
        ]

        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep'):
                send_completion_message(
                    chat_id=123456,
                    project_name='Test',
                    items_count=10,
                )

        assert mock_bot.send_message.call_count == 3

    def test_success_path_unchanged(self, mock_bot):
        """Normal success path — no retries triggered, returns True."""
        with patch('backend.telegram_notifier._get_bot', return_value=mock_bot):
            with patch('time.sleep') as mock_sleep:
                result = send_completion_message(
                    chat_id=123456,
                    project_name='Test',
                    items_count=10,
                )

        assert result is True
        mock_bot.send_message.assert_called_once()
        mock_sleep.assert_not_called()  # No failures = no retries
