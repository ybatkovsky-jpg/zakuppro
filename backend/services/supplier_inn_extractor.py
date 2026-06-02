"""
Supplier INN Extractor Service.

This module provides functionality to extract Russian INN (Individual Taxpayer Number)
from Supplier.requisites text field. Handles multiple format variations including
INN with colon, INN with space, and lowercase/uppercase variants.

Features:
- Multiple format support: "INN: 1234567890", "ИНН 1234567890", "inn 1234567890"
- Case-insensitive matching
- Returns None if INN not found
- Comprehensive logging for extraction success/failure
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# INN pattern: Russian INN is 10 or 12 digits
# - 10 digits for legal entities
# - 12 digits for individuals
# Use (?<!\d) and (?!\d) for word boundaries with digits
INN_PATTERN_10 = r"(?<!\d)\d{10}(?!\d)"  # Exactly 10 digits
INN_PATTERN_12 = r"(?<!\d)\d{12}(?!\d)"  # Exactly 12 digits
INN_PATTERN = r"(?<!\d)(\d{10}|\d{12})(?!\d)"  # Either 10 or 12 digits

# Prefix patterns in Russian and English, case-insensitive
# Note: We'll use re.IGNORECASE flag when matching
INN_PREFIXES = [
    r"ИНН\s*:",      # Russian with colon: ИНН: 1234567890
    r"INN\s*:",      # English with colon: INN: 1234567890
    r"ИНН\s+",       # Russian with space: ИНН 1234567890
    r"INN\s+",       # English with space: INN 1234567890
]


def extract_inn_from_requisites(requisites: Optional[str]) -> Optional[str]:
    """
    Extract INN from Supplier.requisites text field.

    Searches for INN patterns in multiple formats:
    - "INN: 1234567890" or "ИНН: 1234567890" (with colon)
    - "INN 1234567890" or "ИНН 1234567890" (with space)
    - Case-insensitive variants

    Args:
        requisites: Supplier.requisites text field containing banking details and INN

    Returns:
        INN as string if found (10 or 12 digits), None otherwise

    Examples:
        >>> extract_inn_from_requisites("ИНН: 1234567890")
        '1234567890'
        >>> extract_inn_from_requisites("INN 987654321012")
        '987654321012'
        >>> extract_inn_from_requisites("No INN here")
        None
    """
    if not requisites:
        logger.debug("INN extraction failed: requisites is None or empty")
        return None

    requisites_stripped = requisites.strip()
    if not requisites_stripped:
        logger.debug("INN extraction failed: requisites is empty after strip")
        return None

    # Try each prefix pattern with 10-digit INN
    for prefix_pattern in INN_PREFIXES:
        full_pattern_10 = prefix_pattern + r"\s*" + INN_PATTERN_10
        match = re.search(full_pattern_10, requisites_stripped, re.IGNORECASE)
        if match:
            inn_value = re.search(INN_PATTERN_10, match.group(0)).group(0)
            logger.info(f"INN extracted successfully: {inn_value}")
            return inn_value

    # Try each prefix pattern with 12-digit INN
    for prefix_pattern in INN_PREFIXES:
        full_pattern_12 = prefix_pattern + r"\s*" + INN_PATTERN_12
        match = re.search(full_pattern_12, requisites_stripped, re.IGNORECASE)
        if match:
            inn_value = re.search(INN_PATTERN_12, match.group(0)).group(0)
            logger.info(f"INN extracted successfully: {inn_value}")
            return inn_value

    # If no prefix match, try to find any 10 or 12 digit sequence as fallback
    # This handles malformed requisites where INN prefix might be missing
    inn_match = re.search(INN_PATTERN_10, requisites_stripped)
    if inn_match:
        inn_value = inn_match.group(0)
        logger.info(f"INN extracted (fallback, no prefix): {inn_value}")
        return inn_value

    inn_match = re.search(INN_PATTERN_12, requisites_stripped)
    if inn_match:
        inn_value = inn_match.group(0)
        logger.info(f"INN extracted (fallback, no prefix): {inn_value}")
        return inn_value

    logger.debug("INN extraction failed: no INN pattern found in requisites")
    return None


def extract_inn_from_requisites_strict(requisites: Optional[str]) -> Optional[str]:
    """
    Extract INN from Supplier.requisites text field (strict mode).

    Unlike extract_inn_from_requisites, this function ONLY matches INN
    when prefixed with INN/ИНN. It does NOT fall back to bare digit sequences.

    Args:
        requisites: Supplier.requisites text field containing banking details and INN

    Returns:
        INN as string if found with proper prefix (10 or 12 digits), None otherwise

    Examples:
        >>> extract_inn_from_requisites_strict("1234567890")
        None
        >>> extract_inn_from_requisites_strict("ИНН: 1234567890")
        '1234567890'
    """
    if not requisites:
        logger.debug("INN extraction (strict) failed: requisites is None or empty")
        return None

    requisites_stripped = requisites.strip()
    if not requisites_stripped:
        logger.debug("INN extraction (strict) failed: requisites is empty after strip")
        return None

    # Try each prefix pattern with 10-digit INN (no fallback)
    for prefix_pattern in INN_PREFIXES:
        full_pattern_10 = prefix_pattern + r"\s*" + INN_PATTERN_10
        match = re.search(full_pattern_10, requisites_stripped, re.IGNORECASE)
        if match:
            inn_value = re.search(INN_PATTERN_10, match.group(0)).group(0)
            logger.info(f"INN extracted (strict): {inn_value}")
            return inn_value

    # Try each prefix pattern with 12-digit INN (no fallback)
    for prefix_pattern in INN_PREFIXES:
        full_pattern_12 = prefix_pattern + r"\s*" + INN_PATTERN_12
        match = re.search(full_pattern_12, requisites_stripped, re.IGNORECASE)
        if match:
            inn_value = re.search(INN_PATTERN_12, match.group(0)).group(0)
            logger.info(f"INN extracted (strict): {inn_value}")
            return inn_value

    logger.debug("INN extraction (strict) failed: no INN with prefix found")
    return None


class SupplierInnExtractor:
    """
    Supplier INN extractor service.

    Provides INN extraction from Supplier.requisites text field.
    Handles multiple format variations and provides both lenient
    and strict extraction modes.
    """

    def __init__(self):
        """Initialize INN extractor."""
        logger.debug("SupplierInnExtractor initialized")

    def extract(self, requisites: Optional[str], strict: bool = False) -> Optional[str]:
        """
        Extract INN from requisites text.

        Args:
            requisites: Supplier.requisites text field
            strict: If True, only match INN with prefix. If False, also match bare digit sequences.

        Returns:
            INN as string if found, None otherwise
        """
        if strict:
            return extract_inn_from_requisites_strict(requisites)
        return extract_inn_from_requisites(requisites)

    def extract_batch(self, requisites_list: list[Optional[str]]) -> dict[int, Optional[str]]:
        """
        Extract INNs from multiple requisites in batch.

        Args:
            requisites_list: List of requisites strings

        Returns:
            Dict mapping index to INN value (or None)
        """
        results = {}
        for idx, requisites in enumerate(requisites_list):
            results[idx] = self.extract(requisites)
        return results
