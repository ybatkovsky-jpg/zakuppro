"""
AI Agent module for BOM extraction from dirty invoice tables.

Uses the provider-agnostic LLMProvider (which supports DeepSeek, OpenAI,
Anthropic, Gemini, Qwen) instead of hardcoded OpenAI GPT-4o.

Handles Russian column mapping and returns structured JSON with validated output.
Includes retry logic with exponential backoff for rate limits and timeouts.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional

from pydantic import BaseModel, Field, model_validator

logger = logging.getLogger(__name__)


class BOMItem(BaseModel):
    """Single item in a Bill of Materials."""

    sku: str = Field(description="Product SKU or article number")
    name: str = Field(description="Product name or description")
    qty: int = Field(description="Quantity", ge=0)
    supplier: Optional[str] = Field(
        default=None,
        description="Supplier name (nullable)"
    )

    model_config = {"from_attributes": True}


class BOMMetadata(BaseModel):
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


class ExtractedBOM(BaseModel):
    """Structured BOM extraction result with validation."""

    items: list[BOMItem] = Field(
        description="List of extracted BOM items",
        default_factory=list
    )
    metadata: Optional[BOMMetadata] = Field(
        default=None,
        description="Optional metadata from the document"
    )

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def validate_items(self) -> "ExtractedBOM":
        """Ensure at least one item is extracted."""
        if not self.items:
            logger.warning("Extracted BOM has no items")
        return self


# JSON Schema for OpenAI structured output
BOM_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sku": {"type": "string", "description": "Product SKU or article number"},
                    "name": {"type": "string", "description": "Product name or description"},
                    "qty": {"type": "integer", "description": "Quantity (must be >= 0)"},
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
SYSTEM_PROMPT = """You are a BOM extraction assistant specialized in Russian invoices and dirty tables.

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
7. IMPORTANT: Your response must be a valid JSON object with the exact structure:
   {"items": [{"sku": "...", "name": "...", "qty": 0, "supplier": "..."}], "metadata": {"project_name": "...", "client": "..."}}
"""


def _get_llm_provider():
    """
    Get the LLM provider instance based on environment configuration.

    Tries providers in order of availability:
    1. DeepSeek (if DEEPSEEK_API_KEY is set) — preferred for cost efficiency
    2. OpenAI (if OPENAI_API_KEY is set)
    3. Qwen (if QWEN_API_KEY and QWEN_BASE_URL are set)

    Falls back to the first available provider with proper API keys.

    Returns:
        BaseLLMProvider instance

    Raises:
        ValueError: If no LLM provider is configured
    """
    from backend.llm_provider import (
        create_llm_provider,
        DeepSeekProvider,
        QwenProvider,
        OpenAIProvider,
        LLMProviderType,
    )

    # Check which providers have API keys configured
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    qwen_key = os.getenv("QWEN_API_KEY")
    qwen_url = os.getenv("QWEN_BASE_URL")

    if deepseek_key:
        logger.info("Using DeepSeek provider for BOM extraction")
        return create_llm_provider(
            primary=LLMProviderType.DEEPSEEK.value,
            secondary=LLMProviderType.OPENAI.value if openai_key else None,
        )
    elif openai_key:
        logger.info("Using OpenAI provider for BOM extraction")
        return create_llm_provider(primary=LLMProviderType.OPENAI.value)
    elif qwen_key and qwen_url:
        logger.info("Using Qwen provider for BOM extraction")
        return create_llm_provider(primary=LLMProviderType.QWEN.value)
    else:
        raise ValueError(
            "No LLM provider configured. Set one of: "
            "DEEPSEEK_API_KEY, OPENAI_API_KEY, or QWEN_API_KEY+QWEN_BASE_URL"
        )


def extract_bom_structure(table_markdown: str) -> dict[str, Any]:
    """
    Extract structured BOM data from markdown table using configured LLM.

    Uses the provider-agnostic LLMProvider which automatically selects
    the best available provider (DeepSeek, OpenAI, Qwen, etc.) based on
    environment configuration.

    Args:
        table_markdown: Markdown table string (from excel_parser)

    Returns:
        Dictionary with items (list) and optional metadata.
        Each item has: sku, name, qty (int), supplier (nullable)

    Raises:
        ValueError: If table_markdown is empty or no LLM provider configured
        LLMProviderError: For API-related errors
    """
    if not table_markdown or not table_markdown.strip():
        raise ValueError("table_markdown cannot be empty")

    from backend.llm_provider import LLMProviderError

    provider = _get_llm_provider()

    prompt = f"Extract BOM from this table:\n\n{table_markdown}"

    try:
        result = provider.call(
            prompt=prompt,
            system_prompt=SYSTEM_PROMPT,
            response_schema=BOM_JSON_SCHEMA,
        )
        logger.info(f"Successfully extracted {len(result.get('items', []))} BOM items")

        # Validate with Pydantic
        validated = ExtractedBOM(**result)
        return validated.model_dump(mode="json")

    except LLMProviderError as e:
        logger.error(f"LLM provider error during BOM extraction: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during BOM extraction: {e}")
        raise


def extract_bom_with_validation(table_markdown: str) -> ExtractedBOM:
    """
    Extract and validate BOM with Pydantic model.

    Returns:
        ExtractedBOM instance with validated items and metadata

    Raises:
        ValidationError: If JSON doesn't match expected schema
        LLMProviderError: For API-related errors
    """
    raw_result = extract_bom_structure(table_markdown)
    return ExtractedBOM(**raw_result)
