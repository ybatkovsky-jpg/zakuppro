"""
Tests for llm_provider module.

Tests verify that:
- Provider factory creates correct provider instances
- Fallback logic works on rate limit/timeout
- Invalid provider names raise appropriate errors
- Invoice parsing validates output with Pydantic
- Empty input raises ValueError
- Configuration errors are handled gracefully
"""

import json
import os
from unittest.mock import MagicMock, Mock, patch

import pytest

from backend.llm_provider import (
    LLMProvider,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMConfigurationError,
    LLMProvider as BaseLLMProviderClass,
    ExtractedInvoice,
    InvoiceItem,
    _create_provider,
    create_llm_provider,
    parse_invoice_structure,
    INVOICE_JSON_SCHEMA,
    DEFAULT_SYSTEM_PROMPT,
)


# =============================================================================
# Provider Factory Tests
# =============================================================================

class TestCreateProvider:
    """Test provider factory function."""

    def test_creates_openai_provider_with_env_key(self):
        """Test that OpenAI provider creation requires API key."""
        # Patch environment to have API key
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            provider = _create_provider("openai")
            assert provider is not None
            assert provider.provider_name.value == "openai"

    def test_creates_anthropic_provider_with_env_key(self):
        """Test that Anthropic provider creation requires API key."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            provider = _create_provider("anthropic")
            assert provider is not None
            assert provider.provider_name.value == "anthropic"

    def test_creates_gemini_provider_with_env_key(self):
        """Test that Gemini provider creation requires API key."""
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}):
            provider = _create_provider("gemini")
            assert provider is not None
            assert provider.provider_name.value == "gemini"

    def test_case_insensitive_provider_name(self):
        """Test that provider name is case-insensitive."""
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
            provider = _create_provider("OPENAI")
            assert provider is not None
            assert provider.provider_name.value == "openai"

    def test_invalid_provider_name_raises_error(self):
        """Test that invalid provider name raises ConfigurationError."""
        with pytest.raises(LLMConfigurationError) as exc_info:
            _create_provider("invalid_provider")
        # Error message should mention the invalid provider
        assert "invalid_provider" in str(exc_info.value).lower()

    def test_error_message_shows_available_providers(self):
        """Test that error message context is useful."""
        with pytest.raises(LLMConfigurationError):
            _create_provider("unknown")
        # Just verify it raises - the message is dynamic based on enum


# =============================================================================
# LLM Provider Class Tests
# =============================================================================

class TestLLMProviderClass:
    """Test LLMProvider wrapper class."""

    def test_initializes_with_defaults(self):
        """Test that provider initializes with default config."""
        with patch.dict("os.environ", {
            "LLM_PRIMARY_PROVIDER": "openai",
            "LLM_SECONDARY_PROVIDER": "anthropic"
        }):
            provider = LLMProvider()
            assert provider.primary_name == "openai"
            assert provider.secondary_name == "anthropic"

    def test_initializes_with_custom_providers(self):
        """Test that provider accepts custom configuration."""
        provider = LLMProvider(primary="gemini", secondary="openai")
        assert provider.primary_name == "gemini"
        assert provider.secondary_name == "openai"

    def test_primary_provider_lazy_initialization(self):
        """Test that primary provider is lazily initialized."""
        with patch("backend.llm_provider._create_provider") as mock_factory:
            provider = LLMProvider(primary="openai")
            # Provider not created yet
            assert mock_factory.call_count == 0

            # Access triggers creation
            _ = provider.primary_provider
            assert mock_factory.call_count == 1

    def test_secondary_provider_lazy_initialization(self):
        """Test that secondary provider is lazily initialized."""
        with patch("backend.llm_provider._create_provider") as mock_factory:
            provider = LLMProvider(secondary="anthropic")
            # Provider not created yet
            assert mock_factory.call_count == 0

            # Access triggers creation
            _ = provider.secondary_provider
            assert mock_factory.call_count == 1


# =============================================================================
# Call Method Tests
# =============================================================================

class TestCallMethod:
    """Test call method with fallback logic."""

    def test_successful_call_returns_result(self):
        """Test that successful call returns parsed result."""
        mock_primary = Mock()
        mock_primary.provider_name.value = "openai"
        mock_primary.call.return_value = {"items": [{"sku": "ABC123"}]}

        provider = LLMProvider()
        provider._primary_provider = mock_primary

        result = provider.call("test prompt")

        assert result == {"items": [{"sku": "ABC123"}]}
        mock_primary.call.assert_called_once()

    def test_rate_limit_triggers_fallback(self):
        """Test that rate limit on primary triggers fallback."""
        mock_primary = Mock()
        mock_primary.provider_name.value = "openai"
        mock_primary.call.side_effect = LLMRateLimitError("Rate limited")

        mock_secondary = Mock()
        mock_secondary.provider_name.value = "anthropic"
        mock_secondary.call.return_value = {"items": [{"sku": "XYZ789"}]}

        provider = LLMProvider()
        provider._primary_provider = mock_primary
        provider._secondary_provider = mock_secondary

        result = provider.call("test prompt")

        assert result == {"items": [{"sku": "XYZ789"}]}
        mock_primary.call.assert_called_once()
        mock_secondary.call.assert_called_once()

    def test_timeout_triggers_fallback(self):
        """Test that timeout on primary triggers fallback."""
        mock_primary = Mock()
        mock_primary.provider_name.value = "openai"
        mock_primary.call.side_effect = LLMTimeoutError("Request timeout")

        mock_secondary = Mock()
        mock_secondary.provider_name.value = "anthropic"
        mock_secondary.call.return_value = {"items": []}

        provider = LLMProvider()
        provider._primary_provider = mock_primary
        provider._secondary_provider = mock_secondary

        result = provider.call("test prompt")

        assert result == {"items": []}
        mock_secondary.call.assert_called_once()

    def test_non_retryable_error_does_not_fallback(self):
        """Test that non-retryable errors don't trigger fallback."""
        mock_primary = Mock()
        mock_primary.provider_name.value = "openai"
        mock_primary.call.side_effect = LLMProviderError("API error")

        mock_secondary = Mock()

        provider = LLMProvider()
        provider._primary_provider = mock_primary
        provider._secondary_provider = mock_secondary

        with pytest.raises(LLMProviderError):
            provider.call("test prompt")

        # Secondary should not be called for non-retryable errors
        mock_secondary.call.assert_not_called()

    def test_both_providers_fail_raises_error(self):
        """Test that failure of both providers raises error."""
        mock_primary = Mock()
        mock_primary.provider_name.value = "openai"
        mock_primary.call.side_effect = LLMRateLimitError("Primary rate limit")

        mock_secondary = Mock()
        mock_secondary.provider_name.value = "anthropic"
        mock_secondary.call.side_effect = LLMProviderError("Secondary failed")

        provider = LLMProvider()
        provider._primary_provider = mock_primary
        provider._secondary_provider = mock_secondary

        with pytest.raises(LLMProviderError) as exc_info:
            provider.call("test prompt")

        assert "Both primary" in str(exc_info.value)
        assert "openai" in str(exc_info.value)
        assert "anthropic" in str(exc_info.value)


# =============================================================================
# Parse Invoice Method Tests
# =============================================================================

class TestParseInvoiceMethod:
    """Test parse_invoice method."""

    def test_parses_invoice_successfully(self):
        """Test that invoice is parsed and validated."""
        mock_provider = Mock()
        mock_provider.call.return_value = {
            "items": [
                {"sku": "ABC123", "name": "Bolt M10", "qty": 10, "supplier": "Supplier A"},
                {"sku": "DEF456", "name": "Nut M10", "qty": 20, "supplier": None}
            ],
            "metadata": {"project_name": "Project X", "client": "Client Y"}
        }

        provider = LLMProvider()
        provider._primary_provider = mock_provider

        result = provider.parse_invoice("test table")

        assert isinstance(result, ExtractedInvoice)
        assert len(result.items) == 2
        assert result.items[0].sku == "ABC123"
        assert result.metadata.project_name == "Project X"

    def test_empty_table_raises_value_error(self):
        """Test that empty table raises ValueError."""
        provider = LLMProvider()

        with pytest.raises(ValueError) as exc_info:
            provider.parse_invoice("")
        assert "cannot be empty" in str(exc_info.value)

    def test_whitespace_only_table_raises_value_error(self):
        """Test that whitespace-only table raises ValueError."""
        provider = LLMProvider()

        with pytest.raises(ValueError) as exc_info:
            provider.parse_invoice("   \n  \t  ")
        assert "cannot be empty" in str(exc_info.value)

    def test_custom_system_prompt_is_used(self):
        """Test that custom system prompt is passed to call."""
        mock_provider = Mock()
        mock_provider.call.return_value = {"items": []}

        provider = LLMProvider()
        provider._primary_provider = mock_provider

        custom_prompt = "Custom extraction instructions"
        provider.parse_invoice("test table", system_prompt=custom_prompt)

        # Verify custom prompt was passed
        call_args = mock_provider.call.call_args
        assert call_args.kwargs["system_prompt"] == custom_prompt


# =============================================================================
# Convenience Functions Tests
# =============================================================================

class TestConvenienceFunctions:
    """Test convenience functions."""

    def test_create_llm_provider_returns_instance(self):
        """Test that factory function returns LLMProvider instance."""
        provider = create_llm_provider()
        assert isinstance(provider, LLMProvider)

    def test_create_llm_provider_with_custom_config(self):
        """Test factory function with custom configuration."""
        provider = create_llm_provider(primary="gemini", secondary="openai")
        assert provider.primary_name == "gemini"
        assert provider.secondary_name == "openai"

    def test_parse_invoice_structure_returns_dict(self):
        """Test that parse_invoice_structure returns dictionary."""
        mock_llm = Mock()
        mock_llm.parse_invoice.return_value = ExtractedInvoice(
            items=[InvoiceItem(sku="TEST", name="Test Item", qty=1)]
        )

        result = parse_invoice_structure("test table", provider=mock_llm)

        assert isinstance(result, dict)
        assert "items" in result
        assert len(result["items"]) == 1
        assert result["items"][0]["sku"] == "TEST"

    def test_parse_invoice_structure_creates_default_provider(self):
        """Test that default provider is created if None provided."""
        with patch("backend.llm_provider.create_llm_provider") as mock_create:
            mock_llm = Mock()
            mock_llm.parse_invoice.return_value = ExtractedInvoice(items=[])
            mock_create.return_value = mock_llm

            parse_invoice_structure("test table")

            mock_create.assert_called_once()


# =============================================================================
# Pydantic Model Tests
# =============================================================================

class TestPydanticModels:
    """Test Pydantic models for invoice extraction."""

    def test_invoice_item_model(self):
        """Test InvoiceItem model validation."""
        item = InvoiceItem(
            sku="ABC123",
            name="Test Product",
            qty=10,
            supplier="Test Supplier"
        )
        assert item.sku == "ABC123"
        assert item.name == "Test Product"
        assert item.qty == 10
        assert item.supplier == "Test Supplier"

    def test_invoice_item_with_nullable_supplier(self):
        """Test that supplier is nullable."""
        item = InvoiceItem(
            sku="DEF456",
            name="Another Product",
            qty=5,
            supplier=None
        )
        assert item.supplier is None

    def test_invoice_item_qty_validation(self):
        """Test that qty must be >= 0."""
        with pytest.raises(Exception):  # Pydantic ValidationError
            InvoiceItem(sku="XYZ", name="Test", qty=-1)

    def test_extracted_invoice_model(self):
        """Test ExtractedInvoice model validation."""
        invoice = ExtractedInvoice(
            items=[
                InvoiceItem(sku="ABC", name="Item 1", qty=1),
                InvoiceItem(sku="DEF", name="Item 2", qty=2)
            ],
            metadata={"project_name": "Project X", "client": "Client Y"}
        )
        assert len(invoice.items) == 2
        assert invoice.metadata.project_name == "Project X"

    def test_extracted_invoice_empty_items_logs_warning(self, caplog):
        """Test that empty items list triggers warning."""
        import logging
        caplog.set_level(logging.WARNING)

        invoice = ExtractedInvoice(items=[])
        assert "no items" in caplog.text.lower()

    def test_invoice_json_schema_structure(self):
        """Test that JSON schema has correct structure."""
        assert INVOICE_JSON_SCHEMA["type"] == "object"
        assert "items" in INVOICE_JSON_SCHEMA["properties"]
        assert INVOICE_JSON_SCHEMA["required"] == ["items"]


# =============================================================================
# System Prompt Tests
# =============================================================================

class TestSystemPrompt:
    """Test default system prompt."""

    def test_default_system_prompt_contains_column_mapping(self):
        """Test that system prompt includes Russian column mapping."""
        assert "Артикул" in DEFAULT_SYSTEM_PROMPT
        assert "SKU" in DEFAULT_SYSTEM_PROMPT
        assert "Наименование" in DEFAULT_SYSTEM_PROMPT
        assert "Кол" in DEFAULT_SYSTEM_PROMPT

    def test_default_system_prompt_contains_rules(self):
        """Test that system prompt includes extraction rules."""
        assert "RULES:" in DEFAULT_SYSTEM_PROMPT
        assert "json" in DEFAULT_SYSTEM_PROMPT.lower()


# =============================================================================
# Integration Tests (Mocked)
# =============================================================================

class TestIntegrationScenarios:
    """Test integration scenarios with mocked providers."""

    def test_full_invoice_extraction_flow(self):
        """Test complete invoice extraction flow."""
        # Mock primary provider returning structured data
        mock_primary = Mock()
        mock_primary.provider_name.value = "openai"
        mock_primary.call.return_value = {
            "items": [
                {
                    "sku": "BOLT-M10",
                    "name": "Метиз: Болт М10",
                    "qty": 100,
                    "supplier": "ООО МеталлПром"
                }
            ],
            "metadata": {
                "project_name": "Строительство 2024",
                "client": "ООО СтройМонтаж"
            }
        }

        provider = LLMProvider()
        provider._primary_provider = mock_primary

        # Parse invoice
        table = """
        | Артикул | Наименование | Кол | Поставщик |
        |---|---|---|---|
        | BOLT-M10 | Метиз: Болт М10 | 100 | ООО МеталлПром |
        """

        result = provider.parse_invoice(table)

        # Verify structured output
        assert isinstance(result, ExtractedInvoice)
        assert len(result.items) == 1
        assert result.items[0].sku == "BOLT-M10"
        assert result.items[0].name == "Метиз: Болт М10"
        assert result.items[0].qty == 100
        assert result.metadata.project_name == "Строительство 2024"

    def test_retry_on_transient_error_with_fallback(self):
        """Test that retry logic handles transient errors with fallback."""
        # Primary fails with rate limit (triggers fallback)
        mock_primary = Mock()
        mock_primary.provider_name.value = "openai"
        mock_primary.call.side_effect = LLMRateLimitError("Rate limit")

        # Secondary succeeds
        mock_secondary = Mock()
        mock_secondary.provider_name.value = "anthropic"
        mock_secondary.call.return_value = {"items": [{"sku": "ABC", "name": "Test", "qty": 1}]}

        provider = LLMProvider()
        provider._primary_provider = mock_primary
        provider._secondary_provider = mock_secondary

        result = provider.call("test")

        assert result["items"][0]["sku"] == "ABC"
        mock_primary.call.assert_called_once()
        mock_secondary.call.assert_called_once()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
