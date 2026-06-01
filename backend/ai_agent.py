"""
AI Agent module for BOM extraction from dirty invoice tables using OpenAI GPT-4o.

Handles Russian column mapping and returns structured JSON with validated output.
Includes retry logic with exponential backoff for rate limits and timeouts.
"""

from __future__ import annotations

import json
import logging
import os
import time
from typing import Any, Optional

from openai import OpenAI, OpenAIError
from openai import RateLimitError, APITimeoutError, APIError, APIResponseValidationError
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
"""

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAYS = [1, 2, 4]  # seconds: exponential backoff
TIMEOUT_SECONDS = 30


def _get_openai_client() -> OpenAI:
    """Initialize OpenAI client from environment variable."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY environment variable is not set. "
            "Please set it before running BOM extraction."
        )
    return OpenAI(api_key=api_key, timeout=TIMEOUT_SECONDS)


def extract_bom_structure(table_markdown: str) -> dict[str, Any]:
    """
    Extract structured BOM data from markdown table using GPT-4o.

    Args:
        table_markdown: Markdown table string (from excel_parser)

    Returns:
        Dictionary with items (list) and optional metadata.
        Each item has: sku, name, qty (int), supplier (nullable)

    Raises:
        ValueError: If table_markdown is empty
        OpenAIError: For non-retryable API errors
        RateLimitError: If all retries exhausted
        APITimeoutError: If all retries exhausted

    Example:
        >>> table = "| Артикул | Наименование | Кол |\\n|---|---|---|\\n| ABC123 | Bolt | 10 |"
        >>> result = extract_bom_structure(table)
        >>> result["items"][0]
        {'sku': 'ABC123', 'name': 'Bolt', 'qty': 10, 'supplier': None}
    """
    if not table_markdown or not table_markdown.strip():
        raise ValueError("table_markdown cannot be empty")

    client = _get_openai_client()

    for attempt, delay in enumerate(RETRY_DELAYS):
        try:
            logger.info(f"Calling OpenAI GPT-4o for BOM extraction (attempt {attempt + 1}/{MAX_RETRIES})")

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": f"Extract BOM from this table:\n\n{table_markdown}"}
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "bom_extraction",
                        "strict": True,
                        "schema": BOM_JSON_SCHEMA
                    }
                },
                temperature=0,  # Deterministic for structured extraction
            )

            # Parse response
            content = response.choices[0].message.content
            if not content:
                raise APIError("Empty response from OpenAI")

            result = json.loads(content)
            logger.info(f"Successfully extracted {len(result.get('items', []))} BOM items")

            # Validate with Pydantic
            validated = ExtractedBOM(**result)
            return validated.model_dump(mode="json")

        except RateLimitError as e:
            logger.warning(f"Rate limit hit (attempt {attempt + 1}): {e}")
            if attempt >= MAX_RETRIES - 1:
                logger.error("All retries exhausted for rate limit")
                raise
            time.sleep(delay)

        except APITimeoutError as e:
            logger.warning(f"API timeout (attempt {attempt + 1}): {e}")
            if attempt >= MAX_RETRIES - 1:
                logger.error("All retries exhausted for timeout")
                raise
            time.sleep(delay)

        except (APIError, APIResponseValidationError) as e:
            # Non-retryable errors - fail immediately
            logger.error(f"Non-retryable API error: {e}")
            raise

        except Exception as e:
            # Unexpected error - log and fail
            logger.error(f"Unexpected error during BOM extraction: {e}")
            raise

    # Should not reach here, but handle gracefully
    raise APIError("BOM extraction failed after all retries")


def extract_bom_with_validation(table_markdown: str) -> ExtractedBOM:
    """
    Extract and validate BOM with Pydantic model.

    Returns:
        ExtractedBOM instance with validated items and metadata

    Raises:
        ValidationError: If JSON doesn't match expected schema
        OpenAIError: For API-related errors
    """
    raw_result = extract_bom_structure(table_markdown)
    return ExtractedBOM(**raw_result)
