"""
Invoice Parser Service for PDF and Excel files.

This module provides functionality to parse invoice files in PDF and Excel formats,
extract structured data using LLM, and prepare it for database storage.

Features:
- PDF text extraction using pdfplumber
- Excel file parsing using pandas
- LLM-based structured extraction via llm_provider
- Unit price and total price calculation
"""

from __future__ import annotations

import io
import logging
from typing import Optional, Tuple
from decimal import Decimal, InvalidOperation

try:
    from openai import RateLimitError
except ImportError:
    RateLimitError = None

from backend.llm_provider import (
    LLMProvider,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
    ExtractedInvoice,
    InvoiceItem as LLMInvoiceItem,
)

logger = logging.getLogger(__name__)

# Supported file extensions
PDF_EXTENSIONS = {'.pdf'}
EXCEL_EXTENSIONS = {'.xlsx', '.xls', '.xlsm'}


class InvoiceParser:
    """
    Invoice parser service for PDF and Excel files.

    Extracts structured invoice data using:
    1. File content reading (PDF/Excel)
    2. Text/table extraction
    3. LLM-based structured extraction
    4. Price validation and calculation
    """

    def __init__(self, llm_provider: Optional[LLMProvider] = None):
        """
        Initialize invoice parser.

        Args:
            llm_provider: Optional LLMProvider instance (creates default if None)
        """
        self.llm_provider = llm_provider or LLMProvider()

    def parse_file(
        self,
        filename: str,
        file_content: bytes,
        metadata: Optional[dict] = None
    ) -> dict:
        """
        Parse invoice file (PDF or Excel) and extract structured data.

        Args:
            filename: Original filename (e.g., 'invoice.pdf')
            file_content: Binary file content
            metadata: Optional additional metadata (email headers, etc.)

        Returns:
            Dictionary with keys:
                - status: 'success' or 'error'
                - items: List of dicts with sku, name, qty, unit_price, total_price
                - metadata: Optional dict with project_name, client
                - raw_text: Extracted text from file (for debugging)
                - error: Error message if status='error'

        Raises:
            ValueError: If file format is not supported
            LLMProviderError: If LLM parsing fails
        """
        logger.info(f"Parsing invoice file: {filename} ({len(file_content)} bytes)")

        # Detect file type
        file_ext = self._get_file_extension(filename)
        is_pdf = file_ext in PDF_EXTENSIONS
        is_excel = file_ext in EXCEL_EXTENSIONS

        if not (is_pdf or is_excel):
            raise ValueError(
                f"Unsupported file format: {file_ext}. "
                f"Supported: PDF ({PDF_EXTENSIONS}), Excel ({EXCEL_EXTENSIONS})"
            )

        # Extract content based on file type
        if is_pdf:
            markdown_text = self._extract_pdf_text(file_content)
        else:  # Excel
            markdown_text = self._extract_excel_text(file_content)

        if not markdown_text or not markdown_text.strip():
            return {
                'status': 'error',
                'error': 'No text extracted from file',
                'items': [],
                'raw_text': ''
            }

        # Parse with LLM
        try:
            extracted: ExtractedInvoice = self.llm_provider.parse_invoice(markdown_text)

            # Convert to dict with calculated prices
            items = []
            for item in extracted.items:
                item_dict = item.model_dump()
                # Calculate unit_price and total_price (default to 0 if not in LLM output)
                item_dict['unit_price'] = item_dict.get('unit_price', 0)
                item_dict['total_price'] = item_dict.get('total_price', 0)
                items.append(item_dict)

            result = {
                'status': 'success',
                'items': items,
                'metadata': extracted.metadata.model_dump() if extracted.metadata else {},
                'raw_text': markdown_text,
            }

            logger.info(f"Successfully parsed invoice with {len(items)} items")
            return result

        except (LLMRateLimitError, LLMTimeoutError) as e:
            # Transient errors - should be retried by Celery
            logger.error(f"Transient LLM error: {e}")
            raise
        except LLMProviderError as e:
            # Non-retryable LLM error
            logger.error(f"LLM provider error: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'items': [],
                'raw_text': markdown_text
            }
        except Exception as e:
            # Unexpected error
            logger.error(f"Unexpected error during parsing: {e}", exc_info=True)
            return {
                'status': 'error',
                'error': str(e),
                'items': [],
                'raw_text': markdown_text
            }

    def _get_file_extension(self, filename: str) -> str:
        """Extract file extension from filename."""
        import os
        return os.path.splitext(filename)[1].lower()

    def _extract_pdf_text(self, file_content: bytes) -> str:
        """
        Extract text from PDF file using pdfplumber.

        Args:
            file_content: Binary PDF content

        Returns:
            Extracted text as markdown-formatted string
        """
        import pdfplumber

        pdf_file = io.BytesIO(file_content)
        text_parts = []

        try:
            with pdfplumber.open(pdf_file) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(f"## Page {page_num + 1}\n\n{page_text}")

                # Also try extracting tables for better structure
                for page_num, page in enumerate(pdf.pages):
                    tables = page.extract_tables()
                    if tables:
                        text_parts.append(f"\n### Tables Page {page_num + 1}\n")
                        for table in tables:
                            text_parts.append(self._table_to_markdown(table))

        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise

        return "\n\n".join(text_parts)

    def _extract_excel_text(self, file_content: bytes) -> str:
        """
        Extract text from Excel file using pandas.

        Args:
            file_content: Binary Excel content

        Returns:
            Extracted data as markdown-formatted string
        """
        import pandas as pd

        excel_file = io.BytesIO(file_content)
        markdown_parts = []

        try:
            # Read all sheets
            xls = pd.ExcelFile(excel_file)
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)

                # Clean dataframe (remove empty rows/columns)
                df = df.dropna(how='all').dropna(axis=1, how='all')

                if not df.empty:
                    markdown_parts.append(f"## Sheet: {sheet_name}\n")
                    markdown_parts.append(self._dataframe_to_markdown(df))

        except Exception as e:
            logger.error(f"Excel extraction error: {e}")
            raise

        return "\n\n".join(markdown_parts)

    def _table_to_markdown(self, table: list) -> str:
        """
        Convert extracted PDF table to markdown format.

        Args:
            table: List of lists (rows x columns)

        Returns:
            Markdown table string
        """
        if not table or not table[0]:
            return ""

        # Filter out completely empty rows
        filtered_table = [
            row for row in table
            if any(cell is not None and str(cell).strip() for cell in row)
        ]

        if not filtered_table:
            return ""

        # Create markdown table
        headers = filtered_table[0]
        rows = filtered_table[1:]

        # Header row
        md_lines = [" | ".join(str(cell) if cell is not None else "" for cell in headers)]
        md_lines.append("|" + "---|" * len(headers))

        # Data rows
        for row in rows:
            # Pad row to match header length
            while len(row) < len(headers):
                row.append("")
            md_lines.append(" | ".join(str(cell) if cell is not None else "" for cell in row[:len(headers)]))

        return "\n".join(md_lines)

    def _dataframe_to_markdown(self, df) -> str:
        """
        Convert pandas DataFrame to markdown table.

        Args:
            df: pandas DataFrame

        Returns:
            Markdown table string
        """
        # Convert to markdown
        return df.to_markdown(index=False) if hasattr(df, 'to_markdown') else str(df)


def create_invoice_parser(
    llm_provider: Optional[LLMProvider] = None
) -> InvoiceParser:
    """
    Factory function to create InvoiceParser instance.

    Args:
        llm_provider: Optional LLMProvider instance

    Returns:
        Configured InvoiceParser instance
    """
    return InvoiceParser(llm_provider=llm_provider)


# Convenience function for simple parsing
def parse_invoice_file(
    filename: str,
    file_content: bytes,
    metadata: Optional[dict] = None
) -> dict:
    """
    Parse invoice file (PDF or Excel) and extract structured data.

    This is a convenience function that creates a parser and parses the file.

    Args:
        filename: Original filename
        file_content: Binary file content
        metadata: Optional additional metadata

    Returns:
        Dictionary with status, items, metadata, raw_text, or error
    """
    parser = create_invoice_parser()
    return parser.parse_file(filename, file_content, metadata)
