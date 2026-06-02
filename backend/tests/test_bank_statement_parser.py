"""
Tests for bank_statement_parser service module.

Tests verify that:
- Factory function creates BankStatementParser instances
- CP1251 and UTF-8 encoding handling works correctly
- Tinkoff format parses with ПолучательИНН field (3 transactions)
- Ozon format parses with Получатель1 field variation (3 transactions)
- Date parsing handles DD.MM.YYYY format
- Amount parsing handles Decimal with fractions (.75, .25)
- Field variations (ИНН vs 1) are handled correctly
- Cyrillic text (bank names, descriptions) renders correctly
- Edge cases: empty lines, missing fields, empty files
"""

from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pytest

from backend.services.bank_statement_parser import (
    BankStatementParser,
    create_bank_statement_parser,
    parse_bank_statement_file,
)


# =============================================================================
# Factory Function Tests
# =============================================================================

class TestCreateBankStatementParser:
    """Test create_bank_statement_parser factory function."""

    def test_creates_parser_instance(self):
        """Test that factory creates BankStatementParser instance."""
        parser = create_bank_statement_parser()
        assert isinstance(parser, BankStatementParser)

    def test_parser_has_required_attributes(self):
        """Test that parser initializes with required attributes."""
        parser = create_bank_statement_parser()
        assert hasattr(parser, '_encoding_used')
        assert hasattr(parser, '_field_variations_encountered')
        assert parser._encoding_used is None
        assert parser._field_variations_encountered == []

    def test_convenience_parse_function(self):
        """Test that parse_bank_statement_file convenience function works."""
        content = "1CClientBankExchange\nСекцияДокумент\nДатаДокумента=01.06.2026\nСумма=1000\nКонецДокумента\nКонецФайла\n".encode('utf-8')
        result = parse_bank_statement_file(content)
        assert isinstance(result, dict)
        assert 'transactions' in result
        assert 'bank_name' in result


# =============================================================================
# BankStatementParser Initialization Tests
# =============================================================================

class TestBankStatementParserInit:
    """Test BankStatementParser initialization."""

    def test_initializes_with_none_encoding(self):
        """Test that parser initializes with None encoding."""
        parser = BankStatementParser()
        assert parser._encoding_used is None

    def test_initializes_with_empty_field_variations(self):
        """Test that parser initializes with empty field variations list."""
        parser = BankStatementParser()
        assert parser._field_variations_encountered == []

    def test_has_inn_field_variations_constant(self):
        """Test that INN_FIELD_VARIATIONS constant is defined."""
        assert hasattr(BankStatementParser, 'INN_FIELD_VARIATIONS')
        assert 'payer' in BankStatementParser.INN_FIELD_VARIATIONS
        assert 'receiver' in BankStatementParser.INN_FIELD_VARIATIONS

    def test_has_bank_field_variations_constant(self):
        """Test that BANK_FIELD_VARIATIONS constant is defined."""
        assert hasattr(BankStatementParser, 'BANK_FIELD_VARIATIONS')
        assert 'ПлательщикБанк1' in BankStatementParser.BANK_FIELD_VARIATIONS
        assert 'ПолучательБанк1' in BankStatementParser.BANK_FIELD_VARIATIONS


# =============================================================================
# Tinkoff Fixture Parsing Tests
# =============================================================================

class TestTinkoffFixtureParsing:
    """Test Tinkoff bank statement format parsing."""

    def test_tinkoff_fixture_path_exists(self):
        """Test that Tinkoff fixture file exists."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        assert fixture_path.exists(), f"Tinkoff fixture not found at {fixture_path}"

    def test_tinkoff_parsing_transaction_count(self):
        """Test that Tinkoff fixture parses 3 transactions."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert len(result['transactions']) == 3, f"Expected 3 transactions, got {len(result['transactions'])}"

    def test_tinkoff_first_transaction_amount(self):
        """Test that first Tinkoff transaction has correct amount."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][0]['amount'] == Decimal('150000.00')

    def test_tinkoff_second_transaction_amount(self):
        """Test that second Tinkoff transaction has correct amount with fraction."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][1]['amount'] == Decimal('85000.50')

    def test_tinkoff_third_transaction_amount(self):
        """Test that third Tinkoff transaction has correct amount."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][2]['amount'] == Decimal('250000.00')

    def test_tinkoff_transaction_dates(self):
        """Test that Tinkoff transactions have correct dates."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][0]['transaction_date'] == datetime(2026, 6, 2)
        assert result['transactions'][1]['transaction_date'] == datetime(2026, 6, 1)
        assert result['transactions'][2]['transaction_date'] == datetime(2026, 5, 31)

    def test_tinkoff_inn_field_variation(self):
        """Test that Tinkoff uses ПолучательИНН field variation."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        # First transaction has ПолучательИНН
        assert result['transactions'][0]['supplier_inn'] == '123456789012'
        assert 'ПолучательИНН' in parser._field_variations_encountered

    def test_tinkoff_second_inn(self):
        """Test that second Tinkoff transaction INN is parsed correctly."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][1]['supplier_inn'] == '9876543210'

    def test_tinkoff_bank_name(self):
        """Test that Tinkoff bank name is extracted correctly."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['bank_name'] == 'ТИНЬКОФФ БАНК'

    def test_tinkoff_cyrillic_description(self):
        """Test that Tinkoff Cyrillic description renders correctly."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert 'Оплата за товары по счету' in result['transactions'][0]['description']
        assert 'без НДС' in result['transactions'][0]['description']

    def test_tinkoff_operation_type(self):
        """Test that Tinkoff operation type is parsed correctly."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][0]['operation_type'] == 'Покупка'


# =============================================================================
# Ozon Fixture Parsing Tests
# =============================================================================

class TestOzonFixtureParsing:
    """Test Ozon bank statement format parsing with Получатель1 field."""

    def test_ozon_fixture_path_exists(self):
        """Test that Ozon fixture file exists."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        assert fixture_path.exists(), f"Ozon fixture not found at {fixture_path}"

    def test_ozon_parsing_transaction_count(self):
        """Test that Ozon fixture parses 3 transactions."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert len(result['transactions']) == 3, f"Expected 3 transactions, got {len(result['transactions'])}"

    def test_ozon_transaction_amounts(self):
        """Test that Ozon transaction amounts with fractions are correct."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][0]['amount'] == Decimal('98000.75')
        assert result['transactions'][1]['amount'] == Decimal('125000.00')
        assert result['transactions'][2]['amount'] == Decimal('67500.25')

    def test_ozon_inn_field_variation(self):
        """Test that Ozon uses Получатель1 field variation."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        # First transaction has Получатель1
        assert result['transactions'][0]['supplier_inn'] == '3210987654'
        assert 'Получатель1' in parser._field_variations_encountered

    def test_ozon_all_inns(self):
        """Test that all Ozon INNs are parsed correctly with Получатель1 field."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][0]['supplier_inn'] == '3210987654'
        assert result['transactions'][1]['supplier_inn'] == '6543210987'
        assert result['transactions'][2]['supplier_inn'] == '987654321098'

    def test_ozon_bank_name(self):
        """Test that Ozon bank name is extracted correctly."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['bank_name'] == 'АО "ОЗОН БАНК"'

    def test_ozon_cyrillic_descriptions(self):
        """Test that Ozon Cyrillic descriptions render correctly."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert 'металлопрокат' in result['transactions'][0]['description']
        assert 'электрооборудование' in result['transactions'][1]['description']
        assert 'Предоплата за товары' in result['transactions'][2]['description']

    def test_ozon_transaction_dates(self):
        """Test that Ozon transactions have correct dates."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'][0]['transaction_date'] == datetime(2026, 6, 2)
        assert result['transactions'][1]['transaction_date'] == datetime(2026, 6, 2)
        assert result['transactions'][2]['transaction_date'] == datetime(2026, 6, 1)


# =============================================================================
# Encoding Handling Tests
# =============================================================================

class TestEncodingHandling:
    """Test CP1251 and UTF-8 encoding handling."""

    def test_cp1251_encoding_detected(self):
        """Test that CP1251 encoding is detected and used."""
        # Create CP1251-encoded content that will fail UTF-8
        # Use a character that is valid in CP1251 but invalid in UTF-8
        content = "1CClientBankExchange\nСекцияДокумент\nДатаДокумента=01.06.2026\nСумма=1000\nКонецДокумента\nКонецФайла\n".encode('cp1251')

        parser = BankStatementParser()
        parser.parse(content)

        assert parser._encoding_used == 'cp1251'

    def test_utf8_fallback(self):
        """Test UTF-8 fallback when CP1251 fails."""
        # Cyrillic capital И (U+0418) encodes to d0 98 in UTF-8
        # CP1251 cannot decode byte 0x98, forcing UTF-8 fallback
        content = "1CClientBankExchange\nИ\nСекцияДокумент\nДатаДокумента=01.06.2026\nСумма=1000\nКонецДокумента\nКонецФайла\n".encode('utf-8')

        parser = BankStatementParser()
        parser.parse(content)

        assert parser._encoding_used == 'utf-8'

    def test_cyrillic_text_renders_correctly(self):
        """Test that Cyrillic text renders correctly from UTF-8 fixture."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        # Check Cyrillic characters render correctly (fixture is UTF-8)
        assert 'ТИНЬКОФФ БАНК' == result['bank_name']
        assert 'ООО "ЗакупПро"' in result['raw_lines'][10]  # Плательщик field
        # Verify encoding detected as UTF-8 for the fixture
        assert parser._encoding_used == 'utf-8'

    def test_invalid_content_returns_empty_transactions(self):
        """Test that unparseable content returns empty transactions."""
        # Create content with non-CP1251/UTF-8 bytes that decodes but has no transactions
        # CP1251 will decode any bytes, so we get empty results
        content = b'\xff\xfe'

        parser = BankStatementParser()
        result = parser.parse(content)

        # Should decode with CP1251 (accepts any bytes) but find no transactions
        assert result['transactions'] == []
        assert result['bank_name'] == 'Unknown'
        assert parser._encoding_used == 'cp1251'


# =============================================================================
# Field Variations Tests
# =============================================================================

class TestFieldVariations:
    """Test handling of ИНН vs 1 field name variations."""

    def test_inn_field_variations_in_constant(self):
        """Test that both INN field variations are defined."""
        variations = BankStatementParser.INN_FIELD_VARIATIONS
        assert 'ПолучательИНН' in variations['receiver']
        assert 'Получатель1' in variations['receiver']

    def test_field_variations_tracked_during_parsing(self):
        """Test that encountered field variations are tracked."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        parser.parse(content)

        # Ozon uses Получатель1
        assert 'Получатель1' in parser._field_variations_encountered

    def test_tinkoff_uses_poluchatel_inn(self):
        """Test that Tinkoff format uses ПолучательИНН."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        parser.parse(content)

        assert 'ПолучательИНН' in parser._field_variations_encountered

    def test_ozon_uses_poluchatel_1(self):
        """Test that Ozon format uses Получатель1."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'ozon_bank_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        parser.parse(content)

        assert 'Получатель1' in parser._field_variations_encountered


# =============================================================================
# Date Parsing Tests
# =============================================================================

class TestDateParsing:
    """Test DD.MM.YYYYY date format parsing."""

    def test_parse_date_valid_format(self):
        """Test parsing valid DD.MM.YYYY date."""
        parser = BankStatementParser()
        result = parser._parse_date('01.06.2026')

        assert result == datetime(2026, 6, 1)

    def test_parse_date_different_days(self):
        """Test parsing dates with different day values."""
        parser = BankStatementParser()

        assert parser._parse_date('31.05.2026') == datetime(2026, 5, 31)
        assert parser._parse_date('15.12.2025') == datetime(2025, 12, 15)
        assert parser._parse_date('01.01.2024') == datetime(2024, 1, 1)

    def test_parse_date_invalid_format_returns_none(self):
        """Test that invalid date format returns None."""
        parser = BankStatementParser()

        assert parser._parse_date('2026-06-01') is None
        assert parser._parse_date('invalid') is None
        assert parser._parse_date('') is None

    def test_parse_date_with_none_value(self):
        """Test that None value for date_str returns None."""
        parser = BankStatementParser()

        assert parser._parse_date(None) is None


# =============================================================================
# Amount Parsing Tests
# =============================================================================

class TestAmountParsing:
    """Test Decimal amount parsing with fractions."""

    def test_parse_amount_integer(self):
        """Test parsing integer amount."""
        parser = BankStatementParser()
        result = parser._parse_amount('150000.00')

        assert result == Decimal('150000.00')

    def test_parse_amount_with_fraction(self):
        """Test parsing amount with fractional part."""
        parser = BankStatementParser()

        assert parser._parse_amount('85000.50') == Decimal('85000.50')
        assert parser._parse_amount('98000.75') == Decimal('98000.75')
        assert parser._parse_amount('67500.25') == Decimal('67500.25')

    def test_parse_amount_with_comma_separator(self):
        """Test parsing amount with comma as decimal separator."""
        parser = BankStatementParser()

        # Should convert comma to period
        assert parser._parse_amount('1000,50') == Decimal('1000.50')

    def test_parse_amount_with_spaces(self):
        """Test parsing amount with spaces (common in Russian format)."""
        parser = BankStatementParser()

        # Should remove spaces
        assert parser._parse_amount('1 500 000.00') == Decimal('1500000.00')

    def test_parse_amount_invalid_returns_none(self):
        """Test that invalid amount returns None."""
        parser = BankStatementParser()

        assert parser._parse_amount('invalid') is None
        assert parser._parse_amount('') is None

    def test_parse_amount_with_none_value(self):
        """Test that None value for amount_str returns None."""
        parser = BankStatementParser()

        assert parser._parse_amount(None) is None


# =============================================================================
# Edge Cases Tests
# =============================================================================

class TestEdgeCases:
    """Test edge cases: empty lines, missing fields, empty files."""

    def test_empty_file(self):
        """Test parsing completely empty file."""
        parser = BankStatementParser()
        result = parser.parse(b'')

        assert result['transactions'] == []
        assert result['bank_name'] == 'Unknown'

    def test_file_with_only_headers(self):
        """Test file with headers but no transactions."""
        content = "1CClientBankExchange\nВерсияФормата 1.03\nКонецФайла\n".encode('utf-8')
        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'] == []

    def test_section_with_empty_lines(self):
        """Test section with empty lines is handled correctly."""
        # Use Cyrillic capital И to force UTF-8 decoding
        # Also test empty lines handling
        content = (
            "1CClientBankExchange\n"
            "\n"
            "\n"
            "\n"
            "И\n"  # Forces UTF-8 (contains byte 0x98)
            "СекцияДокумент\n"
            "ДатаДокумента=01.06.2026\n"
            "\n"
            "Сумма=1000\n"
            "\n"
            "КонецДокумента\n"
            "КонецФайла\n"
        ).encode('utf-8')

        parser = BankStatementParser()
        result = parser.parse(content)

        # Should skip empty lines and parse successfully
        assert len(result['transactions']) == 1
        assert result['transactions'][0]['amount'] == Decimal('1000')
        assert parser._encoding_used == 'utf-8'

    def test_transaction_missing_date(self):
        """Test that transaction missing date is skipped."""
        content = "1CClientBankExchange\nСекцияДокумент\nСумма=1000\nКонецДокумента\nКонецФайла\n".encode('utf-8')
        parser = BankStatementParser()
        result = parser.parse(content)

        # Transaction without date should be skipped
        assert len(result['transactions']) == 0

    def test_transaction_missing_amount(self):
        """Test that transaction missing amount is skipped."""
        content = "1CClientBankExchange\nСекцияДокумент\nДатаДокумента=01.06.2026\nКонецДокумента\nКонецФайла\n".encode('utf-8')
        parser = BankStatementParser()
        result = parser.parse(content)

        # Transaction without amount should be skipped
        assert len(result['transactions']) == 0

    def test_malformed_line_skipped(self):
        """Test that malformed lines without '=' are skipped."""
        # Use Cyrillic capital И to force UTF-8 decoding
        content = (
            "1CClientBankExchange\n"
            "И\n"  # Forces UTF-8
            "СекцияДокумент\n"
            "ДатаДокумента=01.06.2026\n"
            "InvalidLine\n"  # Line without =
            "Сумма=1000\n"
            "КонецДокумента\n"
            "КонецФайла\n"
        ).encode('utf-8')

        parser = BankStatementParser()
        result = parser.parse(content)

        # Should parse successfully despite malformed line
        assert len(result['transactions']) == 1
        assert parser._encoding_used == 'utf-8'

    def test_no_section_documents(self):
        """Test file without СекцияДокумент blocks."""
        content = "1CClientBankExchange\nВерсияФормата 1.03\nКонецФайла\n".encode('utf-8')
        parser = BankStatementParser()
        result = parser.parse(content)

        assert result['transactions'] == []
        assert result['bank_name'] == 'Unknown'

    def test_period_start_and_end_dates(self):
        """Test that period_start and period_end are calculated correctly."""
        fixture_path = Path(__file__).parent / 'fixtures' / 'tinkoff_statement.txt'
        content = fixture_path.read_bytes()

        parser = BankStatementParser()
        result = parser.parse(content)

        # Period should span from earliest to latest transaction
        assert result['period_start'] == datetime(2026, 5, 31)
        assert result['period_end'] == datetime(2026, 6, 2)


# =============================================================================
# Bank Name Extraction Tests
# =============================================================================

class TestBankNameExtraction:
    """Test bank name extraction from section lines."""

    def test_extract_bank_name_from_payer_bank(self):
        """Test extracting bank name from ПлательщикБанк1 field."""
        lines = [
            'ПлательщикБанк1=ТИНЬКОФФ БАНК',
            'ПолучательБанк1=Some Bank',
        ]
        parser = BankStatementParser()
        result = parser._extract_bank_name(lines)

        assert result == 'ТИНЬКОФФ БАНК'

    def test_extract_bank_name_from_receiver_bank(self):
        """Test extracting bank name from ПолучательБанк1 field."""
        lines = [
            'ПолучательБанк1=АО "ОЗОН БАНК"',
        ]
        parser = BankStatementParser()
        result = parser._extract_bank_name(lines)

        assert result == 'АО "ОЗОН БАНК"'

    def test_extract_bank_name_no_match(self):
        """Test that None is returned when no bank field found."""
        lines = [
            'ДатаДокумента=01.06.2026',
            'Сумма=1000',
        ]
        parser = BankStatementParser()
        result = parser._extract_bank_name(lines)

        assert result is None

    def test_extract_bank_name_empty_lines(self):
        """Test that empty lines list returns None."""
        parser = BankStatementParser()
        result = parser._extract_bank_name([])

        assert result is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
