"""
Provider-agnostic LLM wrapper with fallback support.

Supports OpenAI, Anthropic Claude, and Google Gemini with automatic fallback
on rate limit, timeout, or API errors. Configuration-driven provider selection.
"""

from __future__ import annotations

import json
import logging
import os
import time
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, Optional, TypeAlias

from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)


# =============================================================================
# Configuration
# =============================================================================

class LLMProviderType(str, Enum):
    """Supported LLM provider types."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


# Environment configuration with defaults
LLM_PRIMARY_PROVIDER = os.getenv("LLM_PRIMARY_PROVIDER", LLMProviderType.OPENAI.value)
LLM_SECONDARY_PROVIDER = os.getenv("LLM_SECONDARY_PROVIDER", LLMProviderType.ANTHROPIC.value)
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))

# Retry delays (exponential backoff)
RETRY_DELAYS = [1, 2, 4]  # seconds


# =============================================================================
# Pydantic Models for Invoice/BOM Extraction
# =============================================================================

class InvoiceItem(BaseModel):
    """Single item extracted from an invoice."""

    sku: str = Field(description="Product SKU or article number")
    name: str = Field(description="Product name or description")
    qty: int = Field(description="Quantity", ge=0)
    supplier: Optional[str] = Field(
        default=None,
        description="Supplier name (nullable)"
    )

    model_config = {"from_attributes": True}


class InvoiceMetadata(BaseModel):
    """Metadata extracted from the invoice/table."""

    project_name: Optional[str] = Field(
        default=None,
        description="Project or order name if found"
    )
    client: Optional[str] = Field(
        default=None,
        description="Client or customer name if found"
    )

    model_config = {"from_attributes": True}


class ExtractedInvoice(BaseModel):
    """Structured invoice extraction result with validation."""

    items: list[InvoiceItem] = Field(
        description="List of extracted invoice items",
        default_factory=list
    )
    metadata: Optional[InvoiceMetadata] = Field(
        default=None,
        description="Optional metadata from the document"
    )

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def validate_items(self) -> "ExtractedInvoice":
        """Ensure at least one item is extracted."""
        if not self.items:
            logger.warning("Extracted invoice has no items")
        return self


# =============================================================================
# Base Provider Interface
# =============================================================================

class BaseLLMProvider(ABC):
    """Abstract base class for LLM providers."""

    provider_name: LLMProvider

    def __init__(self, timeout: int = LLM_TIMEOUT_SECONDS):
        self.timeout = timeout
        self._client: Optional[Any] = None

    @abstractmethod
    def _initialize_client(self) -> Any:
        """Initialize the provider-specific client."""
        pass

    @property
    def client(self) -> Any:
        """Lazy initialization of client."""
        if self._client is None:
            self._client = self._initialize_client()
        return self._client

    @abstractmethod
    def _call_api(
        self,
        prompt: str,
        system_prompt: str,
        response_schema: dict[str, Any]
    ) -> dict[str, Any]:
        """Provider-specific API call implementation."""
        pass

    @abstractmethod
    def _is_rate_limit_error(self, error: Exception) -> bool:
        """Check if error is a rate limit error."""
        pass

    @abstractmethod
    def _is_timeout_error(self, error: Exception) -> bool:
        """Check if error is a timeout error."""
        pass

    def call(
        self,
        prompt: str,
        system_prompt: str,
        response_schema: dict[str, Any],
        max_retries: int = LLM_MAX_RETRIES
    ) -> dict[str, Any]:
        """
        Call the LLM with retry logic for transient errors.

        Args:
            prompt: User prompt
            system_prompt: System prompt for the model
            response_schema: Expected JSON schema for response
            max_retries: Maximum number of retry attempts

        Returns:
            Parsed JSON response as dictionary

        Raises:
            LLMProviderError: For non-retryable errors
            LLMRateLimitError: If all retries exhausted for rate limit
            LLMTimeoutError: If all retries exhausted for timeout
        """
        for attempt, delay in enumerate(RETRY_DELAYS[:max_retries]):
            try:
                logger.info(
                    f"Calling {self.provider_name.value} (attempt {attempt + 1}/{max_retries})"
                )

                result = self._call_api(prompt, system_prompt, response_schema)

                logger.info(f"Successfully got response from {self.provider_name.value}")
                return result

            except Exception as e:
                is_rate_limit = self._is_rate_limit_error(e)
                is_timeout = self._is_timeout_error(e)

                if is_rate_limit:
                    logger.warning(
                        f"Rate limit hit on {self.provider_name.value} "
                        f"(attempt {attempt + 1}): {e}"
                    )
                    if attempt >= max_retries - 1:
                        logger.error("All retries exhausted for rate limit")
                        raise LLMRateLimitError(
                            f"{self.provider_name.value} rate limit: {e}"
                        ) from e
                    time.sleep(delay)
                    continue

                if is_timeout:
                    logger.warning(
                        f"Timeout on {self.provider_name.value} "
                        f"(attempt {attempt + 1}): {e}"
                    )
                    if attempt >= max_retries - 1:
                        logger.error("All retries exhausted for timeout")
                        raise LLMTimeoutError(
                            f"{self.provider_name.value} timeout: {e}"
                        ) from e
                    time.sleep(delay)
                    continue

                # Non-retryable error - fail immediately
                logger.error(
                    f"Non-retryable error from {self.provider_name.value}: {e}"
                )
                raise LLMProviderError(
                    f"{self.provider_name.value} error: {e}"
                ) from e

        # Should not reach here
        raise LLMProviderError("LLM call failed after all retries")


# =============================================================================
# OpenAI Provider
# =============================================================================

class OpenAIProvider(BaseLLMProvider):
    """OpenAI GPT provider implementation."""

    provider_name = LLMProviderType.OPENAI

    def _initialize_client(self) -> Any:
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        model = os.getenv("OPENAI_MODEL", "gpt-4o")
        logger.info(f"Initializing OpenAI client with model: {model}")
        self.model = model
        return OpenAI(api_key=api_key, timeout=self.timeout)

    def _call_api(
        self,
        prompt: str,
        system_prompt: str,
        response_schema: dict[str, Any]
    ) -> dict[str, Any]:
        from openai import APIError, APIResponseValidationError

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "invoice_extraction",
                    "strict": True,
                    "schema": response_schema
                }
            },
            temperature=0,
        )

        content = response.choices[0].message.content
        if not content:
            raise APIError("Empty response from OpenAI")

        result = json.loads(content)
        return result

    def _is_rate_limit_error(self, error: Exception) -> bool:
        from openai import RateLimitError
        return isinstance(error, RateLimitError)

    def _is_timeout_error(self, error: Exception) -> bool:
        from openai import APITimeoutError
        return isinstance(error, APITimeoutError)


# =============================================================================
# Anthropic Claude Provider
# =============================================================================

class AnthropicProvider(BaseLLMProvider):
    """Anthropic Claude provider implementation."""

    provider_name = LLMProviderType.ANTHROPIC

    def _initialize_client(self) -> Any:
        from anthropic import Anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable is not set")
        model = os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        logger.info(f"Initializing Anthropic client with model: {model}")
        self.model = model
        return Anthropic(api_key=api_key, timeout=self.timeout)

    def _call_api(
        self,
        prompt: str,
        system_prompt: str,
        response_schema: dict[str, Any]
    ) -> dict[str, Any]:
        from anthropic import APIError, APIResponseValidationError

        # Claude requires tool use for structured output
        tool_schema = self._convert_to_claude_tool(response_schema)

        response = self.client.messages.create(
            model=self.model,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
            tools=[tool_schema],
            max_tokens=4096,
            temperature=0,
        )

        # Extract tool use response
        content = response.content
        tool_use = None
        for block in content:
            if block.type == "tool_use":
                tool_use = block
                break

        if not tool_use or not tool_use.input:
            raise APIResponseValidationError("No tool use response from Claude")

        return tool_use.input

    def _convert_to_claude_tool(self, json_schema: dict) -> dict:
        """Convert JSON schema to Claude tool format."""
        return {
            "name": "extract_invoice",
            "description": "Extract structured invoice data",
            "input_schema": json_schema
        }

    def _is_rate_limit_error(self, error: Exception) -> bool:
        from anthropic import RateLimitError as AnthropicRateLimitError
        return isinstance(error, AnthropicRateLimitError)

    def _is_timeout_error(self, error: Exception) -> bool:
        from anthropic import APITimeoutError as AnthropicTimeoutError
        return isinstance(error, AnthropicTimeoutError)


# =============================================================================
# Google Gemini Provider
# =============================================================================

class GeminiProvider(BaseLLMProvider):
    """Google Gemini provider implementation."""

    provider_name = LLMProviderType.GEMINI

    def _initialize_client(self) -> Any:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-exp")
        logger.info(f"Initializing Gemini client with model: {model}")
        genai.configure(api_key=api_key)
        self.model_name = model
        return genai.GenerativeModel(model)

    def _call_api(
        self,
        prompt: str,
        system_prompt: str,
        response_schema: dict[str, Any]
    ) -> dict[str, Any]:
        # Gemini 2.0 flash has native JSON schema support
        response = self.client.generate_json(
            contents=prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": response_schema,
                "temperature": 0,
            }
        )

        result = json.loads(response.text)
        return result

    def _is_rate_limit_error(self, error: Exception) -> bool:
        # Check for rate limit error strings in exception
        error_str = str(error).lower()
        return "rate limit" in error_str or "quota" in error_str

    def _is_timeout_error(self, error: Exception) -> bool:
        from google.api_core.exceptions import DeadlineExceeded
        error_str = str(error).lower()
        return isinstance(error, DeadlineExceeded) or "timeout" in error_str


# =============================================================================
# Custom Exceptions
# =============================================================================

class LLMProviderError(Exception):
    """Base exception for LLM provider errors."""
    pass


class LLMRateLimitError(LLMProviderError):
    """Raised when rate limit is hit."""
    pass


class LLMTimeoutError(LLMProviderError):
    """Raised when request times out."""
    pass


class LLMConfigurationError(LLMProviderError):
    """Raised when provider configuration is invalid."""
    pass


# =============================================================================
# Provider Factory
# =============================================================================

_PROVIDER_CLASSES: dict[str, type[BaseLLMProvider]] = {
    LLMProviderType.OPENAI.value: OpenAIProvider,
    LLMProviderType.ANTHROPIC.value: AnthropicProvider,
    LLMProviderType.GEMINI.value: GeminiProvider,
}


def _create_provider(
    provider_name: str,
    timeout: int = LLM_TIMEOUT_SECONDS
) -> BaseLLMProvider:
    """
    Create a provider instance by name.

    Args:
        provider_name: Provider name (openai, anthropic, gemini)
        timeout: Request timeout in seconds

    Returns:
        Provider instance

    Raises:
        LLMConfigurationError: If provider name is invalid
    """
    provider_name_lower = provider_name.lower()

    # Validate that it's a known provider
    valid_providers = {p.value for p in LLMProviderType}
    if provider_name_lower not in valid_providers:
        raise LLMConfigurationError(
            f"Invalid provider: {provider_name}. "
            f"Must be one of: {sorted(valid_providers)}"
        )

    provider_class = _PROVIDER_CLASSES.get(provider_name_lower)
    if not provider_class:
        raise LLMConfigurationError(f"No provider class found for: {provider_name}")

    return provider_class(timeout=timeout)


# =============================================================================
# JSON Schema for Invoice Extraction
# =============================================================================

INVOICE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sku": {
                        "type": "string",
                        "description": "Product SKU or article number"
                    },
                    "name": {
                        "type": "string",
                        "description": "Product name or description"
                    },
                    "qty": {
                        "type": "integer",
                        "description": "Quantity (must be >= 0)"
                    },
                    "supplier": {
                        "type": ["string", "null"],
                        "description": "Supplier name or null if not found"
                    }
                },
                "required": ["sku", "name", "qty"]
            }
        },
        "metadata": {
            "type": ["object", "null"],
            "properties": {
                "project_name": {"type": "string"},
                "client": {"type": "string"}
            }
        }
    },
    "required": ["items"]
}


# System prompt for Russian column mapping
DEFAULT_SYSTEM_PROMPT = """You are a BOM extraction assistant specialized in Russian invoices and dirty tables.

Extract structured bill-of-materials data from the provided markdown table.

COLUMN MAPPING (Russian to English):
- "Артикул", "SKU", "Код", "Арт." → sku (product article number)
- "Наименование", "Название", "Описание", "Товар" → name (product name/description)
- "Кол", "Количество", "Кол-во", "Qty", "Шт." → qty (quantity as integer)
- "Поставщик", "Supplier" → supplier (supplier name, null if not found)

RULES:
1. Return ONLY valid JSON matching the schema.
2. qty must be a positive integer (convert "5шт" to 5, not "5шт").
3. If a column is missing, use null or empty string for nullable fields.
4. Skip header rows and empty rows - extract only actual data items.
5. Preserve original SKU/name values exactly as shown in the table.
6. If multiple tables exist, extract items from all relevant rows.
"""


# =============================================================================
# Main LLM Provider Class
# =============================================================================

class LLMProvider:
    """
    Provider-agnostic LLM wrapper with fallback support.

    Automatically falls back to secondary provider on rate limit or timeout.
    Configuration-driven provider selection from environment variables.

    Example:
        >>> provider = LLMProvider()
        >>> result = provider.parse_invoice(table_markdown)
        >>> result["items"][0]["sku"]
        'ABC123'
    """

    def __init__(
        self,
        primary: Optional[str] = None,
        secondary: Optional[str] = None,
        timeout: int = LLM_TIMEOUT_SECONDS,
        max_retries: int = LLM_MAX_RETRIES
    ):
        """
        Initialize LLM provider with fallback configuration.

        Args:
            primary: Primary provider name (default: from env LLM_PRIMARY_PROVIDER)
            secondary: Secondary provider name (default: from env LLM_SECONDARY_PROVIDER)
            timeout: Request timeout in seconds
            max_retries: Maximum retries per provider
        """
        self.primary_name = primary or LLM_PRIMARY_PROVIDER
        self.secondary_name = secondary or LLM_SECONDARY_PROVIDER
        self.timeout = timeout
        self.max_retries = max_retries

        self._primary_provider: Optional[BaseLLMProvider] = None
        self._secondary_provider: Optional[BaseLLMProvider] = None

        logger.info(
            f"LLMProvider initialized: primary={self.primary_name}, "
            f"secondary={self.secondary_name}"
        )

    @property
    def primary_provider(self) -> BaseLLMProvider:
        """Lazy initialization of primary provider."""
        if self._primary_provider is None:
            self._primary_provider = _create_provider(self.primary_name, self.timeout)
        return self._primary_provider

    @property
    def secondary_provider(self) -> BaseLLMProvider:
        """Lazy initialization of secondary provider."""
        if self._secondary_provider is None:
            self._secondary_provider = _create_provider(self.secondary_name, self.timeout)
        return self._secondary_provider

    def call(
        self,
        prompt: str,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        response_schema: dict[str, Any] = INVOICE_JSON_SCHEMA
    ) -> dict[str, Any]:
        """
        Call the LLM with automatic fallback on rate limit/timeout.

        Args:
            prompt: User prompt
            system_prompt: System prompt for the model
            response_schema: Expected JSON schema for response

        Returns:
            Parsed JSON response as dictionary

        Raises:
            LLMProviderError: If both primary and secondary providers fail
        """
        # Try primary provider
        try:
            return self.primary_provider.call(
                prompt=prompt,
                system_prompt=system_prompt,
                response_schema=response_schema,
                max_retries=self.max_retries
            )
        except (LLMRateLimitError, LLMTimeoutError) as e:
            logger.warning(
                f"Primary provider {self.primary_name} failed with {type(e).__name__}, "
                f"attempting fallback to {self.secondary_name}"
            )
            # Fallback to secondary provider
            try:
                result = self.secondary_provider.call(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    response_schema=response_schema,
                    max_retries=self.max_retries
                )
                logger.info(f"Successfully recovered using fallback provider {self.secondary_name}")
                return result
            except Exception as fallback_error:
                logger.error(
                    f"Fallback provider {self.secondary_name} also failed: {fallback_error}"
                )
                raise LLMProviderError(
                    f"Both primary ({self.primary_name}) and secondary "
                    f"({self.secondary_name}) providers failed"
                ) from fallback_error
        except Exception as e:
            # Non-retryable error - don't fallback
            logger.error(f"Non-retryable error from primary provider: {e}")
            raise

    def parse_invoice(
        self,
        table_markdown: str,
        system_prompt: str = DEFAULT_SYSTEM_PROMPT
    ) -> ExtractedInvoice:
        """
        Parse invoice/BOM table using LLM.

        Args:
            table_markdown: Markdown table string from excel_parser
            system_prompt: Optional custom system prompt

        Returns:
            ExtractedInvoice instance with validated items and metadata

        Raises:
            ValueError: If table_markdown is empty
            LLMProviderError: For API-related errors
        """
        if not table_markdown or not table_markdown.strip():
            raise ValueError("table_markdown cannot be empty")

        prompt = f"Extract BOM from this table:\n\n{table_markdown}"

        result = self.call(
            prompt=prompt,
            system_prompt=system_prompt,
            response_schema=INVOICE_JSON_SCHEMA
        )

        # Validate with Pydantic
        validated = ExtractedInvoice(**result)
        logger.info(
            f"Successfully parsed invoice with {len(validated.items)} items "
            f"using {self.primary_name}"
        )

        return validated


# =============================================================================
# Convenience Functions
# =============================================================================

def create_llm_provider(
    primary: Optional[str] = None,
    secondary: Optional[str] = None
) -> LLMProvider:
    """
    Factory function to create LLM provider instance.

    Args:
        primary: Primary provider name (default: from env)
        secondary: Secondary provider name (default: from env)

    Returns:
        Configured LLMProvider instance
    """
    return LLMProvider(primary=primary, secondary=secondary)


def parse_invoice_structure(
    table_markdown: str,
    provider: Optional[LLMProvider] = None
) -> dict[str, Any]:
    """
    Parse invoice table to dictionary (backward-compatible with ai_agent).

    Args:
        table_markdown: Markdown table string
        provider: Optional LLMProvider instance (creates default if None)

    Returns:
        Dictionary with items (list) and optional metadata

    Raises:
        ValueError: If table_markdown is empty
        LLMProviderError: For API-related errors
    """
    if provider is None:
        provider = create_llm_provider()

    result = provider.parse_invoice(table_markdown)
    return result.model_dump(mode="json")
