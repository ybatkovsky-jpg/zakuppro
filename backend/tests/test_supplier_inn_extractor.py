"""
Tests for supplier_inn_extractor service module.

Tests verify that:
- INN extraction works with various prefixes (INN:, ИНН:, inn:, etc.)
- INN extraction works with space separator (INN 123..., ИНН 123...)
- Case-insensitive matching works for both Russian and English prefixes
- 10-digit legal entity INNs are extracted correctly
- 12-digit individual INNs are extracted correctly
- Missing INN returns None
- Malformed INNs (wrong digit count) return None
- Empty/None requisites return None
- Strict mode only matches INN with prefix
- Lenient mode matches bare digit sequences as fallback
- Batch extraction processes multiple requisites
- Logger statements capture extraction success/failure
"""

import pytest
import logging
from unittest.mock import patch, MagicMock

from backend.services.supplier_inn_extractor import (
    extract_inn_from_requisites,
    extract_inn_from_requisites_strict,
    SupplierInnExtractor,
    INN_PATTERN,
    INN_PREFIXES,
)


# =============================================================================
# Module Constants Tests
# =============================================================================

class TestConstants:
    """Test module constants."""

    def test_inn_pattern_matches_10_digits(self):
        """Test that INN_PATTERN matches 10-digit sequences."""
        import re
        assert re.search(INN_PATTERN, "1234567890")
        assert re.search(INN_PATTERN, "0123456789")

    def test_inn_pattern_matches_12_digits(self):
        """Test that INN_PATTERN matches 12-digit sequences."""
        import re
        assert re.search(INN_PATTERN, "123456789012")
        assert re.search(INN_PATTERN, "012345678901")

    def test_inn_prefixes_non_empty(self):
        """Test that INN_PREFIXES is not empty."""
        assert len(INN_PREFIXES) > 0

    def test_inn_prefixes_contains_expected_patterns(self):
        """Test that INN_PREFIXES contains expected variations."""
        # Should contain Russian and English variants
        has_russian_upper = any("ИНН" in p for p in INN_PREFIXES)
        has_english_upper = any("INN" in p for p in INN_PREFIXES)
        has_lowercase = any("inn" in p.lower() for p in INN_PREFIXES)

        assert has_russian_upper
        assert has_english_upper
        assert has_lowercase


# =============================================================================
# Extract INN with Prefix Tests
# =============================================================================

class TestExtractInnWithPrefix:
    """Test INN extraction with standard prefixes."""

    def test_russian_inn_with_colon(self):
        """Test extraction of Russian INN with colon (ИНН:)."""
        requisites = "ИНН: 1234567890"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"

    def test_russian_inn_uppercase_with_space(self):
        """Test extraction of Russian INN with space (ИНН)."""
        requisites = "ИНН 1234567890"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"

    def test_english_inn_with_colon(self):
        """Test extraction of English INN with colon (INN:)."""
        requisites = "INN: 987654321012"
        result = extract_inn_from_requisites(requisites)
        assert result == "987654321012"

    def test_english_inn_with_space(self):
        """Test extraction of English INN with space (INN)."""
        requisites = "INN 987654321012"
        result = extract_inn_from_requisites(requisites)
        assert result == "987654321012"


# =============================================================================
# Case Insensitivity Tests
# =============================================================================

class TestCaseInsensitivity:
    """Test case-insensitive INN matching."""

    def test_russian_lowercase_with_colon(self):
        """Test extraction with lowercase Russian prefix (инн:)."""
        requisites = "инн: 1234567890"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"

    def test_russian_lowercase_with_space(self):
        """Test extraction with lowercase Russian prefix (инн)."""
        requisites = "инн 1234567890"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"

    def test_english_lowercase_with_colon(self):
        """Test extraction with lowercase English prefix (inn:)."""
        requisites = "inn: 987654321012"
        result = extract_inn_from_requisites(requisites)
        assert result == "987654321012"

    def test_english_lowercase_with_space(self):
        """Test extraction with lowercase English prefix (inn)."""
        requisites = "inn 987654321012"
        result = extract_inn_from_requisites(requisites)
        assert result == "987654321012"

    def test_mixed_case(self):
        """Test extraction with mixed case prefixes."""
        requisites = "Ин: 1234567890"  # Note: should still work due to fallback
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"


# =============================================================================
# INN Length Tests
# =============================================================================

class TestInnLength:
    """Test INN extraction for different lengths."""

    def test_ten_digit_inn(self):
        """Test extraction of 10-digit legal entity INN."""
        requisites = "ИНН: 1234567890"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"
        assert len(result) == 10

    def test_twelve_digit_inn(self):
        """Test extraction of 12-digit individual INN."""
        requisites = "ИНН: 123456789012"
        result = extract_inn_from_requisites(requisites)
        assert result == "123456789012"
        assert len(result) == 12

    def test_wrong_digit_count_returns_none(self):
        """Test that wrong digit count returns None."""
        requisites = "ИНН: 12345"  # Only 5 digits
        result = extract_inn_from_requisites(requisites)
        assert result is None

    def test_nine_digits_returns_none(self):
        """Test that 9-digit sequences return None."""
        requisites = "ИНН: 123456789"
        result = extract_inn_from_requisites(requisites)
        assert result is None

    def test_eleven_digits_returns_none(self):
        """Test that 11-digit sequences return None."""
        requisites = "ИНН: 12345678901"
        result = extract_inn_from_requisites(requisites)
        assert result is None

    def test_thirteen_digits_returns_none(self):
        """Test that 13-digit sequences return None."""
        requisites = "ИНН: 1234567890123"
        result = extract_inn_from_requisites(requisites)
        assert result is None


# =============================================================================
# Complex Requisites Tests
# =============================================================================

class TestComplexRequisites:
    """Test INN extraction from complex requisites text."""

    def test_full_requisites_text(self):
        """Test extraction from full banking details."""
        requisites = """
        Банк: ПАО СБЕРБАНК
        Р/С: 12345678901234567890
        ИНН: 1234567890
        КПП: 123456789
        """
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"

    def test_inn_at_end_of_text(self):
        """Test extraction when INN is at the end."""
        requisites = "Банк: Сбер, Р/С: 123, ИНН 987654321012"
        result = extract_inn_from_requisites(requisites)
        assert result == "987654321012"

    def test_multiple_inns_returns_first(self):
        """Test that first INN is returned when multiple present."""
        requisites = "ИНН: 1234567890, ИНН: 987654321012"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"  # First one

    def test_inn_with_other_numbers(self):
        """Test extraction when other numbers present."""
        requisites = "Р/С: 12345678901234567890, ИНН: 1234567890, КПП: 123456789"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"


# =============================================================================
# Edge Cases and Missing INN
# =============================================================================

class TestEdgeCases:
    """Test edge cases and missing INN scenarios."""

    def test_none_requisites_returns_none(self):
        """Test that None requisites returns None."""
        result = extract_inn_from_requisites(None)
        assert result is None

    def test_empty_string_returns_none(self):
        """Test that empty string returns None."""
        result = extract_inn_from_requisites("")
        assert result is None

    def test_whitespace_only_returns_none(self):
        """Test that whitespace-only string returns None."""
        result = extract_inn_from_requisites("   ")
        assert result is None

    def test_no_inn_returns_none(self):
        """Test that text without INN returns None."""
        # Use 20-digit account number (realistic for Russian Р/С)
        requisites = "Банк: Сбер, Р/С: 12345678901234567890"
        result = extract_inn_from_requisites(requisites)
        assert result is None

    def test_malformed_inn_returns_none(self):
        """Test that malformed INN returns None."""
        requisites = "ИНН: abcdefghij"
        result = extract_inn_from_requisites(requisites)
        assert result is None


# =============================================================================
# Fallback Extraction Tests (Lenient Mode)
# =============================================================================

class TestFallbackExtraction:
    """Test fallback extraction for malformed requisites."""

    def test_bare_ten_digits_fallback(self):
        """Test that bare 10-digit sequence is extracted as fallback."""
        requisites = "Банк: Сбер, номер: 1234567890"
        result = extract_inn_from_requisites(requisites)
        assert result == "1234567890"

    def test_bare_twelve_digits_fallback(self):
        """Test that bare 12-digit sequence is extracted as fallback."""
        requisites = "Код: 987654321012"
        result = extract_inn_from_requisites(requisites)
        assert result == "987654321012"

    def test_bare_nine_digits_no_fallback(self):
        """Test that bare 9-digit sequence is NOT extracted."""
        requisites = "Код: 123456789"
        result = extract_inn_from_requisites(requisites)
        assert result is None


# =============================================================================
# Strict Mode Tests
# =============================================================================

class TestStrictMode:
    """Test strict mode extraction (prefix required)."""

    def test_strict_with_prefix_succeeds(self):
        """Test strict mode succeeds with proper prefix."""
        requisites = "ИНН: 1234567890"
        result = extract_inn_from_requisites_strict(requisites)
        assert result == "1234567890"

    def test_strict_without_prefix_returns_none(self):
        """Test strict mode returns None without prefix."""
        requisites = "1234567890"
        result = extract_inn_from_requisites_strict(requisites)
        assert result is None

    def test_strict_bare_digits_returns_none(self):
        """Test strict mode returns None for bare digits."""
        requisites = "Банк: Сбер, номер: 1234567890"
        result = extract_inn_from_requisites_strict(requisites)
        assert result is None

    def test_strict_none_returns_none(self):
        """Test strict mode returns None for None input."""
        result = extract_inn_from_requisites_strict(None)
        assert result is None


# =============================================================================
# SupplierInnExtractor Class Tests
# =============================================================================

class TestSupplierInnExtractor:
    """Test SupplierInnExtractor class."""

    def test_initialization(self):
        """Test extractor initialization."""
        extractor = SupplierInnExtractor()
        assert extractor is not None

    def test_extract_lenient_mode(self):
        """Test extract method in lenient mode (default)."""
        extractor = SupplierInnExtractor()
        requisites = "1234567890"  # Bare digits
        result = extractor.extract(requisites, strict=False)
        assert result == "1234567890"

    def test_extract_strict_mode(self):
        """Test extract method in strict mode."""
        extractor = SupplierInnExtractor()
        requisites = "1234567890"  # Bare digits
        result = extractor.extract(requisites, strict=True)
        assert result is None

    def test_extract_strict_with_prefix(self):
        """Test extract method in strict mode with prefix."""
        extractor = SupplierInnExtractor()
        requisites = "ИНН: 1234567890"
        result = extractor.extract(requisites, strict=True)
        assert result == "1234567890"

    def test_extract_default_is_lenient(self):
        """Test that default behavior is lenient."""
        extractor = SupplierInnExtractor()
        requisites = "1234567890"
        result = extractor.extract(requisites)  # strict defaults to False
        assert result == "1234567890"


# =============================================================================
# Batch Extraction Tests
# =============================================================================

class TestBatchExtraction:
    """Test batch INN extraction."""

    def test_extract_batch_multiple(self):
        """Test batch extraction of multiple requisites."""
        extractor = SupplierInnExtractor()
        requisites_list = [
            "ИНН: 1234567890",
            "INN 987654321012",
            "No INN here",
            None,
            "1234567890",
        ]
        results = extractor.extract_batch(requisites_list)

        assert results[0] == "1234567890"
        assert results[1] == "987654321012"
        assert results[2] is None
        assert results[3] is None
        assert results[4] == "1234567890"

    def test_extract_batch_empty_list(self):
        """Test batch extraction with empty list."""
        extractor = SupplierInnExtractor()
        results = extractor.extract_batch([])
        assert results == {}

    def test_extract_batch_all_none(self):
        """Test batch extraction with all None inputs."""
        extractor = SupplierInnExtractor()
        results = extractor.extract_batch([None, None, None])
        assert all(v is None for v in results.values())


# =============================================================================
# Logging Tests
# =============================================================================

class TestLogging:
    """Test logging for extraction success/failure."""

    def test_logging_success(self, caplog):
        """Test that successful extraction is logged."""
        with caplog.at_level(logging.INFO):
            extract_inn_from_requisites("ИНН: 1234567890")

        assert any("INN extracted successfully" in record.message for record in caplog.records)
        assert any("1234567890" in record.message for record in caplog.records)

    def test_logging_failure_no_inn(self, caplog):
        """Test that failed extraction is logged."""
        with caplog.at_level(logging.DEBUG):
            extract_inn_from_requisites("No INN here")

        assert any("INN extraction failed" in record.message for record in caplog.records)

    def test_logging_failure_none(self, caplog):
        """Test that None input is logged."""
        with caplog.at_level(logging.DEBUG):
            extract_inn_from_requisites(None)

        assert any("INN extraction failed" in record.message for record in caplog.records)

    def test_logging_fallback_extraction(self, caplog):
        """Test that fallback extraction is logged."""
        with caplog.at_level(logging.INFO):
            extract_inn_from_requisites("1234567890")

        assert any("INN extracted (fallback" in record.message for record in caplog.records)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
