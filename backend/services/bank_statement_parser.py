"""
Bank Statement Parser Service for 1C ClientBank format.

This module provides functionality to parse 1C ClientBank .txt files,
extract transaction data from Tinkoff and Ozon bank statements with
CP1251 encoding support, and produce structured output compatible
with BankStatement/BankTransaction ORM models.

Features:
- CP1251 decoding with UTF-8 fallback
- Field variation handling (ПолучательИНН vs Получатель1)
- СекцияДокумент block parsing
- Date and amount extraction with proper type conversion
"""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class BankStatementParser:
    """
    Bank statement parser service for 1C ClientBank format files.

    Extracts structured bank statement data using:
    1. CP1251/UTF-8 encoding detection and decoding
    2. СекцияДокумент block parsing
    3. Field variation handling (ПолучательИНН vs Получатель1)
    4. Date and amount parsing with proper type conversion
    """

    # Field variations for INN (payer and receiver)
    INN_FIELD_VARIATIONS = {
        'payer': ['ПлательщикИНН', 'Плательщик1'],
        'receiver': ['ПолучательИНН', 'Получатель1'],
    }

    # Bank name field variations
    BANK_FIELD_VARIATIONS = ['ПлательщикБанк1', 'ПолучательБанк1']

    def __init__(self):
        """Initialize bank statement parser."""
        self._encoding_used: Optional[str] = None
        self._field_variations_encountered: List[str] = []

    def parse(self, content: bytes) -> dict:
        """
        Parse 1C ClientBank .txt file and extract structured data.

        Args:
            content: Binary file content (typically CP1251 encoded)

        Returns:
            Dictionary with keys:
                - bank_name: str (bank name from first transaction)
                - statement_date: datetime (statement date)
                - period_start: datetime (earliest transaction date)
                - period_end: datetime (latest transaction date)
                - transactions: List[dict] with keys:
                    - transaction_date: datetime
                    - amount: Decimal
                    - supplier_inn: str | None
                    - description: str
                    - operation_type: str
                - raw_lines: List[str] (original lines for debugging)

        Raises:
            ValueError: If file format is invalid or cannot be decoded
        """
        logger.info(f"Parsing bank statement ({len(content)} bytes)")

        # Try CP1251 first, then UTF-8 fallback
        lines = self._decode_content(content)
        self._encoding_used = self._encoding_used or 'unknown'

        # Parse header and extract transactions
        transactions = []
        bank_name = None
        first_date = None
        last_date = None

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            if line.startswith('СекцияДокумент'):
                section_lines = []
                i += 1
                # Collect lines until КонецДокумента
                while i < len(lines) and not lines[i].strip().startswith('КонецДокумента'):
                    section_lines.append(lines[i].strip())
                    i += 1

                # Parse the section
                transaction = self._parse_section(section_lines)
                if transaction:
                    transactions.append(transaction)

                    # Extract bank name from first transaction's payer bank
                    if bank_name is None:
                        bank_name = self._extract_bank_name(section_lines)

                    # Track date range
                    if first_date is None or transaction['transaction_date'] < first_date:
                        first_date = transaction['transaction_date']
                    if last_date is None or transaction['transaction_date'] > last_date:
                        last_date = transaction['transaction_date']

            # Stop at КонецФайла
            elif line.startswith('КонецФайла'):
                break

            i += 1

        if not transactions:
            logger.warning("No transactions found in bank statement")
            return {
                'bank_name': bank_name or 'Unknown',
                'statement_date': datetime.now(),
                'period_start': datetime.now(),
                'period_end': datetime.now(),
                'transactions': [],
                'raw_lines': lines
            }

        logger.info(
            f"Successfully parsed {len(transactions)} transactions, "
            f"encoding={self._encoding_used}, "
            f"field_variations={self._field_variations_encountered}"
        )

        return {
            'bank_name': bank_name or 'Unknown',
            'statement_date': last_date or datetime.now(),
            'period_start': first_date or datetime.now(),
            'period_end': last_date or datetime.now(),
            'transactions': transactions,
            'raw_lines': lines
        }

    def _decode_content(self, content: bytes) -> List[str]:
        """
        Decode binary content with CP1251 first, UTF-8 fallback.

        Args:
            content: Binary file content

        Returns:
            List of decoded lines

        Raises:
            ValueError: If content cannot be decoded
        """
        # Try CP1251 first (most common for 1C ClientBank)
        try:
            text = content.decode('cp1251')
            self._encoding_used = 'cp1251'
            logger.debug("Decoded using CP1251 encoding")
            return text.splitlines()
        except (UnicodeDecodeError, LookupError) as e:
            logger.debug(f"CP1251 decode failed: {e}, trying UTF-8")

        # Fallback to UTF-8
        try:
            text = content.decode('utf-8')
            self._encoding_used = 'utf-8'
            logger.debug("Decoded using UTF-8 encoding")
            return text.splitlines()
        except UnicodeDecodeError as e:
            raise ValueError(f"Failed to decode content with CP1251 or UTF-8: {e}")

    def _parse_section(self, section_lines: List[str]) -> Optional[Dict[str, Any]]:
        """
        Parse a СекцияДокумент block and extract transaction data.

        Args:
            section_lines: List of lines within СекцияДокумент...КонецДокумента

        Returns:
            Dictionary with transaction data or None if parsing fails
        """
        if not section_lines:
            return None

        transaction = {
            'transaction_date': None,
            'amount': None,
            'supplier_inn': None,
            'description': '',
            'operation_type': ''
        }

        for line in section_lines:
            if not line or '=' not in line:
                continue

            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()

            # Parse transaction date (ДатаДокумента or ДатаСписания)
            if key in ('ДатаДокумента', 'ДатаСписания', 'ДатаПоступления'):
                if transaction['transaction_date'] is None:
                    transaction['transaction_date'] = self._parse_date(value)

            # Parse amount (Сумма)
            elif key == 'Сумма':
                transaction['amount'] = self._parse_amount(value)

            # Parse operation type (ВидОперации)
            elif key == 'ВидОперации':
                transaction['operation_type'] = value

            # Parse description (НазначениеПлатежа)
            elif key == 'НазначениеПлатежа':
                transaction['description'] = value

            # Parse supplier INN (receiver INN - we pay to suppliers)
            elif key in self.INN_FIELD_VARIATIONS['receiver']:
                if key not in self._field_variations_encountered:
                    self._field_variations_encountered.append(key)
                transaction['supplier_inn'] = value if value else None

        # Only return if we have essential fields
        if transaction['transaction_date'] and transaction['amount'] is not None:
            return transaction

        logger.warning(f"Incomplete transaction section, skipping: {section_lines[:3]}")
        return None

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """
        Parse date in DD.MM.YYYY format.

        Args:
            date_str: Date string in DD.MM.YYYY format

        Returns:
            datetime object or None if parsing fails
        """
        if date_str is None:
            return None
        try:
            return datetime.strptime(date_str, '%d.%m.%Y')
        except (ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse date '{date_str}': {e}")
            return None

    def _parse_amount(self, amount_str: str) -> Optional[Decimal]:
        """
        Parse amount string to Decimal.

        Args:
            amount_str: Amount string (e.g., '150000.00')

        Returns:
            Decimal object or None if parsing fails
        """
        if amount_str is None:
            return None
        try:
            # Remove any whitespace and convert to Decimal
            cleaned = amount_str.strip().replace(',', '.').replace(' ', '')
            return Decimal(cleaned)
        except (InvalidOperation, ValueError, AttributeError) as e:
            logger.warning(f"Failed to parse amount '{amount_str}': {e}")
            return None

    def _extract_bank_name(self, section_lines: List[str]) -> Optional[str]:
        """
        Extract bank name from section lines.

        Args:
            section_lines: List of lines within СекцияДокумент block

        Returns:
            Bank name string or None
        """
        for line in section_lines:
            if not line or '=' not in line:
                continue

            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()

            # Check for bank name field variations
            if key in self.BANK_FIELD_VARIATIONS:
                if value:
                    return value

        return None


def create_bank_statement_parser() -> BankStatementParser:
    """
    Factory function to create BankStatementParser instance.

    Returns:
        Configured BankStatementParser instance
    """
    return BankStatementParser()


def parse_bank_statement_file(content: bytes) -> dict:
    """
    Parse 1C ClientBank .txt file and extract structured data.

    This is a convenience function that creates a parser and parses the file.

    Args:
        content: Binary file content

    Returns:
        Dictionary with bank_name, dates, transactions list, and raw_lines
    """
    parser = create_bank_statement_parser()
    return parser.parse(content)
