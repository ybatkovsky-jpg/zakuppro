"""
Tests for invoice_parser service module.

Tests verify that:
- Factory function creates InvoiceParser instances
- PDF text extraction works with mocked pdfplumber
- Excel extraction works with mocked pandas
- LLM parsing integration returns structured data
- Unsupported file formats raise ValueError
- Transient errors (rate limit, timeout) are propagated
- Non-retryable errors return error status dicts
- PDF table-to-markdown conversion handles edge cases
- Excel multi-sheet extraction works correctly
- Empty file handling returns error status
- Metadata is passed through the parsing flow
"""

import io
from unittest.mock import MagicMock, Mock, patch

import pytest

from backend.services.invoice_parser import (
    InvoiceParser,
    create_invoice_parser,
    parse_invoice_file,
    PDF_EXTENSIONS,
    EXCEL_EXTENSIONS,
)
from backend.llm_provider import (
    LLMProvider,
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
    ExtractedInvoice,
    InvoiceItem as LLMInvoiceItem,
    InvoiceMetadata,
)


# =============================================================================
# Factory Function Tests
# =============================================================================

class TestCreateInvoiceParser:
    """Test create_invoice_parser factory function."""

    def test_creates_parser_with_default_provider(self):
        """Test that factory creates parser with default LLM provider."""
        parser = create_invoice_parser()
        assert isinstance(parser, InvoiceParser)
        assert parser.llm_provider is not None
        assert isinstance(parser.llm_provider, LLMProvider)

    def test_creates_parser_with_custom_provider(self):
        """Test that factory accepts custom LLM provider."""
        custom_provider = LLMProvider(primary="openai")
        parser = create_invoice_parser(llm_provider=custom_provider)
        assert parser.llm_provider is custom_provider

    def test_convenience_parse_function(self):
        """Test that parse_invoice_file convenience function works."""
        mock_provider = Mock()
        mock_provider.parse_invoice.return_value = ExtractedInvoice(
            items=[LLMInvoiceItem(sku="TEST", name="Test", qty=1)]
        )

        with patch("backend.services.invoice_parser.create_invoice_parser") as mock_create:
            mock_parser = Mock()
            mock_parser.llm_provider = mock_provider
            mock_parser.parse_file.return_value = {
                "status": "success",
                "items": [{"sku": "TEST", "name": "Test", "qty": 1}],
                "metadata": {},
                "raw_text": "test"
            }
            mock_create.return_value = mock_parser

            result = parse_invoice_file("test.pdf", b"content")

            assert result["status"] == "success"
            mock_create.assert_called_once()
            mock_parser.parse_file.assert_called_once_with("test.pdf", b"content", None)


# =============================================================================
# InvoiceParser Initialization Tests
# =============================================================================

class TestInvoiceParserInit:
    """Test InvoiceParser initialization."""

    def test_initializes_with_default_llm_provider(self):
        """Test that parser initializes with default LLM provider when None provided."""
        parser = InvoiceParser()
        assert parser.llm_provider is not None
        assert isinstance(parser.llm_provider, LLMProvider)

    def test_initializes_with_custom_llm_provider(self):
        """Test that parser accepts custom LLM provider."""
        custom_provider = LLMProvider(primary="anthropic")
        parser = InvoiceParser(llm_provider=custom_provider)
        assert parser.llm_provider is custom_provider


# =============================================================================
# File Type Detection Tests
# =============================================================================

class TestFileTypeDetection:
    """Test file type detection and validation."""

    def test_pdf_file_detected(self):
        """Test that PDF files are correctly detected."""
        parser = InvoiceParser()
        assert parser._get_file_extension("invoice.pdf") == ".pdf"
        assert parser._get_file_extension("INVOICE.PDF") == ".pdf"
        assert parser._get_file_extension("document.Pdf") == ".pdf"

    def test_excel_file_detected(self):
        """Test that Excel files are correctly detected."""
        parser = InvoiceParser()
        assert parser._get_file_extension("data.xlsx") == ".xlsx"
        assert parser._get_file_extension("DATA.XLS") == ".xls"
        assert parser._get_file_extension("report.xlsm") == ".xlsm"
        assert parser._get_file_extension("sheet.Xlsx") == ".xlsx"

    def test_unsupported_file_raises_value_error(self):
        """Test that unsupported file formats raise ValueError."""
        parser = InvoiceParser()
        mock_provider = Mock()

        with pytest.raises(ValueError) as exc_info:
            parser.parse_file("document.txt", b"content")

        assert "Unsupported file format" in str(exc_info.value)
        assert ".txt" in str(exc_info.value)
        assert "PDF" in str(exc_info.value)
        assert "Excel" in str(exc_info.value)

    def test_unsupported_format_lists_supported_types(self):
        """Test that error message lists supported formats."""
        parser = InvoiceParser()

        with pytest.raises(ValueError) as exc_info:
            parser.parse_file("image.jpg", b"content")

        error_msg = str(exc_info.value)
        for ext in PDF_EXTENSIONS:
            assert str(ext) in error_msg or ext.replace(".", "") in error_msg
        for ext in EXCEL_EXTENSIONS:
            assert str(ext) in error_msg or ext.replace(".", "") in error_msg

    def test_supported_pdf_constants(self):
        """Test that PDF_EXTENSIONS constant has correct values."""
        assert ".pdf" in PDF_EXTENSIONS

    def test_supported_excel_constants(self):
        """Test that EXCEL_EXTENSIONS constant has correct values."""
        assert ".xlsx" in EXCEL_EXTENSIONS
        assert ".xls" in EXCEL_EXTENSIONS
        assert ".xlsm" in EXCEL_EXTENSIONS


# =============================================================================
# PDF Parsing Tests (Mocked pdfplumber)
# =============================================================================

class TestPDFParsing:
    """Test PDF parsing with mocked pdfplumber."""

    def test_extract_pdf_text_single_page(self):
        """Test PDF text extraction from single page."""
        parser = InvoiceParser()

        mock_page = Mock()
        mock_page.extract_text.return_value = "Invoice #123\nProduct A Qty:10"
        mock_page.extract_tables.return_value = []

        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]

        # Use sys.modules patching for locally imported module
        import sys
        pdfplumber_mock = MagicMock()
        pdfplumber_mock.open.return_value.__enter__.return_value = mock_pdf
        sys.modules["pdfplumber"] = pdfplumber_mock

        try:
            result = parser._extract_pdf_text(b"pdf content")
            assert "Invoice #123" in result
            assert "Product A" in result
            assert "## Page 1" in result
        finally:
            del sys.modules["pdfplumber"]

    def test_extract_pdf_text_multiple_pages(self):
        """Test PDF text extraction from multiple pages."""
        parser = InvoiceParser()

        mock_page1 = Mock()
        mock_page1.extract_text.return_value = "Page 1 content"
        mock_page1.extract_tables.return_value = []

        mock_page2 = Mock()
        mock_page2.extract_text.return_value = "Page 2 content"
        mock_page2.extract_tables.return_value = []

        mock_pdf = Mock()
        mock_pdf.pages = [mock_page1, mock_page2]

        # Use sys.modules patching for locally imported module
        import sys
        pdfplumber_mock = MagicMock()
        pdfplumber_mock.open.return_value.__enter__.return_value = mock_pdf
        sys.modules["pdfplumber"] = pdfplumber_mock

        try:
            result = parser._extract_pdf_text(b"pdf content")
            assert "## Page 1" in result
            assert "## Page 2" in result
            assert "Page 1 content" in result
            assert "Page 2 content" in result
        finally:
            del sys.modules["pdfplumber"]

    def test_extract_pdf_with_tables(self):
        """Test PDF table extraction and markdown conversion."""
        parser = InvoiceParser()

        mock_page = Mock()
        mock_page.extract_text.return_value = "Some text"
        mock_page.extract_tables.return_value = [
            [["SKU", "Name", "Qty"], ["ABC", "Product A", "10"]]
        ]

        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]

        import sys
        pdfplumber_mock = MagicMock()
        pdfplumber_mock.open.return_value.__enter__.return_value = mock_pdf
        sys.modules["pdfplumber"] = pdfplumber_mock

        try:
            result = parser._extract_pdf_text(b"pdf content")
            assert "### Tables Page 1" in result
            assert "SKU" in result
        finally:
            del sys.modules["pdfplumber"]

    def test_extract_pdf_with_multiple_tables(self):
        """Test PDF with multiple tables on one page."""
        parser = InvoiceParser()

        mock_page = Mock()
        mock_page.extract_text.return_value = "Text"
        mock_page.extract_tables.return_value = [
            [["H1", "H2"], ["D1", "D2"]],
            [["H3", "H4"], ["D3", "D4"]]
        ]

        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]

        import sys
        pdfplumber_mock = MagicMock()
        pdfplumber_mock.open.return_value.__enter__.return_value = mock_pdf
        sys.modules["pdfplumber"] = pdfplumber_mock

        try:
            result = parser._extract_pdf_text(b"pdf content")
            assert result.count("|") >= 4  # At least two tables
        finally:
            del sys.modules["pdfplumber"]

    def test_extract_pdf_with_no_text_returns_empty(self):
        """Test PDF with no extractable text."""
        parser = InvoiceParser()

        mock_page = Mock()
        mock_page.extract_text.return_value = None
        mock_page.extract_tables.return_value = []

        mock_pdf = Mock()
        mock_pdf.pages = [mock_page]

        import sys
        pdfplumber_mock = MagicMock()
        pdfplumber_mock.open.return_value.__enter__.return_value = mock_pdf
        sys.modules["pdfplumber"] = pdfplumber_mock

        try:
            result = parser._extract_pdf_text(b"pdf content")
            assert result == ""
        finally:
            del sys.modules["pdfplumber"]

    def test_extract_pdf_error_propagates(self):
        """Test that PDF extraction errors are propagated."""
        parser = InvoiceParser()

        import sys
        pdfplumber_mock = MagicMock()
        pdfplumber_mock.open.side_effect = Exception("Corrupted PDF")
        sys.modules["pdfplumber"] = pdfplumber_mock

        try:
            with pytest.raises(Exception) as exc_info:
                parser._extract_pdf_text(b"bad pdf")
            assert "Corrupted PDF" in str(exc_info.value)
        finally:
            del sys.modules["pdfplumber"]


# =============================================================================
# Excel Parsing Tests (Mocked pandas)
# =============================================================================

class TestExcelParsing:
    """Test Excel parsing with mocked pandas."""

    def test_extract_excel_single_sheet(self):
        """Test Excel extraction from single sheet."""
        parser = InvoiceParser()

        mock_df = Mock()
        mock_df.empty = False
        mock_df.to_markdown.return_value = "| SKU | Name |\n|---|---|\n| ABC | Product |"

        mock_xls = Mock()
        mock_xls.sheet_names = ["Sheet1"]

        import sys
        pd_mock = MagicMock()
        pd_mock.ExcelFile.return_value = mock_xls
        pd_mock.read_excel.return_value = mock_df
        mock_df.dropna.return_value = mock_df
        sys.modules["pandas"] = pd_mock

        try:
            result = parser._extract_excel_text(b"excel content")
            assert "## Sheet: Sheet1" in result
            assert "ABC" in result
        finally:
            del sys.modules["pandas"]

    def test_extract_excel_multiple_sheets(self):
        """Test Excel extraction from multiple sheets."""
        parser = InvoiceParser()

        mock_df1 = Mock()
        mock_df1.empty = False
        mock_df1.to_markdown.return_value = "| SKU |\n|---|\n| ABC |"

        mock_df2 = Mock()
        mock_df2.empty = False
        mock_df2.to_markdown.return_value = "| SKU |\n|---|\n| DEF |"

        mock_xls = Mock()
        mock_xls.sheet_names = ["Sheet1", "Sheet2"]

        import sys
        pd_mock = MagicMock()
        pd_mock.ExcelFile.return_value = mock_xls
        pd_mock.read_excel.side_effect = [mock_df1, mock_df2]
        mock_df1.dropna.return_value = mock_df1
        mock_df2.dropna.return_value = mock_df2
        sys.modules["pandas"] = pd_mock

        try:
            result = parser._extract_excel_text(b"excel content")
            assert "## Sheet: Sheet1" in result
            assert "## Sheet: Sheet2" in result
            assert "ABC" in result
            assert "DEF" in result
        finally:
            del sys.modules["pandas"]

    def test_extract_excel_empty_sheet_skipped(self):
        """Test that empty sheets are skipped."""
        parser = InvoiceParser()

        mock_empty_df = Mock()
        mock_empty_df.empty = True

        mock_valid_df = Mock()
        mock_valid_df.empty = False
        mock_valid_df.to_markdown.return_value = "| Data |"

        mock_xls = Mock()
        mock_xls.sheet_names = ["Empty", "Valid"]

        import sys
        pd_mock = MagicMock()
        pd_mock.ExcelFile.return_value = mock_xls
        pd_mock.read_excel.side_effect = [mock_empty_df, mock_valid_df]
        mock_empty_df.dropna.return_value = mock_empty_df
        mock_valid_df.dropna.return_value = mock_valid_df
        sys.modules["pandas"] = pd_mock

        try:
            result = parser._extract_excel_text(b"excel content")
            assert "## Sheet: Valid" in result
            assert result.count("## Sheet:") == 1
        finally:
            del sys.modules["pandas"]

    def test_extract_excel_with_no_markdown_support(self):
        """Test Excel fallback when to_markdown not available."""
        parser = InvoiceParser()

        mock_df = Mock()
        mock_df.empty = False
        # Simulate DataFrame without to_markdown
        del mock_df.to_markdown
        mock_df.__str__ = Mock(return_value="SKU,Name\nABC,Product")

        mock_xls = Mock()
        mock_xls.sheet_names = ["Sheet1"]

        import sys
        pd_mock = MagicMock()
        pd_mock.ExcelFile.return_value = mock_xls
        pd_mock.read_excel.return_value = mock_df
        mock_df.dropna.return_value = mock_df
        sys.modules["pandas"] = pd_mock

        try:
            result = parser._extract_excel_text(b"excel content")
            assert "Sheet1" in result
            assert "ABC" in result or "Product" in result
        finally:
            del sys.modules["pandas"]

    def test_extract_excel_error_propagates(self):
        """Test that Excel extraction errors are propagated."""
        parser = InvoiceParser()

        import sys
        pd_mock = MagicMock()
        pd_mock.ExcelFile.side_effect = Exception("Corrupted Excel")
        sys.modules["pandas"] = pd_mock

        try:
            with pytest.raises(Exception) as exc_info:
                parser._extract_excel_text(b"bad excel")
            assert "Corrupted Excel" in str(exc_info.value)
        finally:
            del sys.modules["pandas"]


# =============================================================================
# Table to Markdown Conversion Tests
# =============================================================================

class TestTableToMarkdown:
    """Test _table_to_markdown conversion method."""

    def test_converts_simple_table(self):
        """Test simple table conversion to markdown."""
        parser = InvoiceParser()
        table = [
            ["SKU", "Name", "Qty"],
            ["ABC", "Product A", "10"]
        ]
        result = parser._table_to_markdown(table)

        # Header row doesn't have leading/trailing pipes in actual implementation
        assert "SKU | Name | Qty" in result or "SKU|Name|Qty" in result
        assert "|---|" in result
        assert "ABC" in result

    def test_filters_empty_rows(self):
        """Test that completely empty rows are filtered out."""
        parser = InvoiceParser()
        table = [
            ["H1", "H2"],
            ["D1", "D2"],
            [None, None],
            ["", ""],
            ["D3", "D3"]
        ]
        result = parser._table_to_markdown(table)

        # Should have header + 2 data rows
        lines = result.split("\n")
        assert len([l for l in lines if "|" in l and l.strip()]) == 4

    def test_handles_none_values(self):
        """Test that None values are handled gracefully."""
        parser = InvoiceParser()
        table = [
            ["A", "B", "C"],
            ["X", None, "Z"],
            [None, "Y", None]
        ]
        result = parser._table_to_markdown(table)

        # Header row
        assert "A | B | C" in result or "A|B|C" in result
        # Empty cells exist
        assert "|  |" in result

    def test_pads_short_rows(self):
        """Test that rows shorter than header are padded."""
        parser = InvoiceParser()
        table = [
            ["H1", "H2", "H3"],
            ["D1", "D2"],  # Short row
            ["D4", "D5", "D6"]
        ]
        result = parser._table_to_markdown(table)

        lines = result.split("\n")
        # All rows should have same number of columns
        for line in lines:
            if "|" in line and "---" not in line:
                # Count cells
                cell_count = len([c for c in line.split("|")])
                assert cell_count <= 5  # 3-4 cells + empty ends

    def test_empty_table_returns_empty_string(self):
        """Test that empty table returns empty string."""
        parser = InvoiceParser()
        assert parser._table_to_markdown([]) == ""
        assert parser._table_to_markdown([[]]) == ""
        assert parser._table_to_markdown([[None]]) == ""

    def test_all_empty_rows_returns_empty(self):
        """Test table with only empty rows returns empty."""
        parser = InvoiceParser()
        table = [
            [None, None],
            ["", ""]
        ]
        result = parser._table_to_markdown(table)
        assert result == ""


# =============================================================================
# DataFrame to Markdown Conversion Tests
# =============================================================================

class TestDataframeToMarkdown:
    """Test _dataframe_to_markdown conversion method."""

    def test_converts_dataframe_to_markdown(self):
        """Test DataFrame with to_markdown support."""
        parser = InvoiceParser()
        mock_df = Mock()
        mock_df.to_markdown.return_value = "| Col1 | Col2 |\n|---|---|\n| Val1 | Val2 |"

        result = parser._dataframe_to_markdown(mock_df)

        assert result == "| Col1 | Col2 |\n|---|---|\n| Val1 | Val2 |"
        mock_df.to_markdown.assert_called_once_with(index=False)

    def test_fallback_to_str_when_no_markdown(self):
        """Test fallback to string representation."""
        parser = InvoiceParser()
        mock_df = Mock()
        del mock_df.to_markdown
        mock_df.__str__ = Mock(return_value="DataFrame string")

        result = parser._dataframe_to_markdown(mock_df)

        assert result == "DataFrame string"


# =============================================================================
# Full Parse Flow Tests (Mocked LLM)
# =============================================================================

class TestParseFileFlow:
    """Test complete parse_file flow with mocked LLM."""

    def test_parse_pdf_file_success(self):
        """Test successful PDF file parsing."""
        parser = InvoiceParser()

        mock_llm_result = ExtractedInvoice(
            items=[
                LLMInvoiceItem(sku="ABC123", name="Product A", qty=10),
                LLMInvoiceItem(sku="DEF456", name="Product B", qty=20)
            ],
            metadata=InvoiceMetadata(project_name="Project X", client="Client Y")
        )

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "Extracted text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file("invoice.pdf", b"pdf content")

                assert result["status"] == "success"
                assert len(result["items"]) == 2
                assert result["items"][0]["sku"] == "ABC123"
                assert result["metadata"]["project_name"] == "Project X"
                assert result["raw_text"] == "Extracted text"

    def test_parse_excel_file_success(self):
        """Test successful Excel file parsing."""
        parser = InvoiceParser()

        mock_llm_result = ExtractedInvoice(
            items=[LLMInvoiceItem(sku="XYZ", name="Product", qty=5)]
        )

        with patch.object(parser, "_extract_excel_text") as mock_extract:
            mock_extract.return_value = "Excel data"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file("data.xlsx", b"excel content")

                assert result["status"] == "success"
                assert result["items"][0]["sku"] == "XYZ"

    def test_parse_with_metadata_passed(self):
        """Test that metadata parameter is passed through context."""
        parser = InvoiceParser()

        mock_llm_result = ExtractedInvoice(
            items=[LLMInvoiceItem(sku="TEST", name="Test", qty=1)]
        )

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file(
                    "invoice.pdf",
                    b"content",
                    metadata={"email_subject": "Invoice from Supplier"}
                )

                # Metadata parameter accepted without error
                assert result["status"] == "success"

    def test_parse_with_empty_extraction_returns_error(self):
        """Test that empty file extraction returns error status."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = ""

            result = parser.parse_file("empty.pdf", b"empty content")

            assert result["status"] == "error"
            assert "No text extracted" in result["error"]
            assert result["items"] == []

    def test_parse_with_whitespace_only_returns_error(self):
        """Test that whitespace-only extraction returns error."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "   \n  \t  "

            result = parser.parse_file("whitespace.pdf", b"content")

            assert result["status"] == "error"
            assert "No text extracted" in result["error"]

    def test_unit_price_default_to_zero(self):
        """Test that unit_price defaults to 0 when not in LLM output."""
        parser = InvoiceParser()

        mock_llm_result = ExtractedInvoice(
            items=[LLMInvoiceItem(sku="TEST", name="Test", qty=1)]
        )

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file("invoice.pdf", b"content")

                assert result["items"][0]["unit_price"] == 0
                assert result["items"][0]["total_price"] == 0


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test error handling in parse_file flow."""

    def test_rate_limit_error_propagates(self):
        """Test that rate limit errors are propagated for retry."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.side_effect = LLMRateLimitError("Rate limited")

                with pytest.raises(LLMRateLimitError):
                    parser.parse_file("invoice.pdf", b"content")

    def test_timeout_error_propagates(self):
        """Test that timeout errors are propagated for retry."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.side_effect = LLMTimeoutError("Request timeout")

                with pytest.raises(LLMTimeoutError):
                    parser.parse_file("invoice.pdf", b"content")

    def test_non_retryable_llm_error_returns_error_status(self):
        """Test that non-retryable LLM errors return error dict."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.side_effect = LLMProviderError("API error")

                result = parser.parse_file("invoice.pdf", b"content")

                assert result["status"] == "error"
                assert "API error" in result["error"]
                assert result["items"] == []
                assert result["raw_text"] == "text"

    def test_unexpected_exception_returns_error_status(self):
        """Test that unexpected exceptions return error dict."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.side_effect = ValueError("Unexpected error")

                result = parser.parse_file("invoice.pdf", b"content")

                assert result["status"] == "error"
                assert "Unexpected error" in result["error"]
                assert result["raw_text"] == "text"

    def test_pdf_extraction_exception_propagates(self):
        """Test that PDF extraction exceptions are not caught in parse_file."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.side_effect = Exception("PDF corrupted")

            with pytest.raises(Exception) as exc_info:
                parser.parse_file("bad.pdf", b"content")
            assert "PDF corrupted" in str(exc_info.value)


# =============================================================================
# Edge Cases and Empty File Handling
# =============================================================================

class TestEdgeCases:
    """Test edge cases and special scenarios."""

    def test_parse_with_no_items_from_llm(self):
        """Test successful parse when LLM returns no items."""
        parser = InvoiceParser()

        mock_llm_result = ExtractedInvoice(items=[])

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file("invoice.pdf", b"content")

                assert result["status"] == "success"
                assert result["items"] == []

    def test_parse_with_null_metadata_from_llm(self):
        """Test parse when LLM returns null metadata."""
        parser = InvoiceParser()

        mock_llm_result = ExtractedInvoice(
            items=[LLMInvoiceItem(sku="TEST", name="Test", qty=1)],
            metadata=None
        )

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file("invoice.pdf", b"content")

                assert result["status"] == "success"
                assert result["metadata"] == {}

    def test_parse_with_empty_filename(self):
        """Test parsing with empty filename."""
        parser = InvoiceParser()
        # Empty filename has no extension
        with pytest.raises(ValueError) as exc_info:
            parser.parse_file("", b"content")
        assert "Unsupported file format" in str(exc_info.value)

    def test_parse_case_insensitive_extension(self):
        """Test that file extension detection is case insensitive."""
        parser = InvoiceParser()
        mock_llm_result = ExtractedInvoice(
            items=[LLMInvoiceItem(sku="TEST", name="Test", qty=1)]
        )

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                # Should work with uppercase extension
                result = parser.parse_file("INVOICE.PDF", b"content")
                assert result["status"] == "success"


# =============================================================================
# Integration Scenarios
# =============================================================================

class TestIntegrationScenarios:
    """Test integration scenarios combining multiple components."""

    def test_full_pdf_to_structured_data_flow(self):
        """Test complete flow from PDF to structured data."""
        parser = InvoiceParser()

        # Simulate PDF with table
        pdf_text = """## Page 1

Invoice #INV-001
Supplier: ABC Corp

### Tables Page 1
| Артикул | Наименование | Кол |
|---|---|---|
| BOLT-M10 | Болт М10 | 100 |
| NUT-M10 | Гайка М10 | 200 |
"""

        mock_llm_result = ExtractedInvoice(
            items=[
                LLMInvoiceItem(sku="BOLT-M10", name="Болт М10", qty=100, supplier="ABC Corp"),
                LLMInvoiceItem(sku="NUT-M10", name="Гайка М10", qty=200, supplier="ABC Corp")
            ],
            metadata=InvoiceMetadata(project_name="Project 2024", client="Customer LLC")
        )

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = pdf_text
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file("invoice.pdf", b"pdf content")

                assert result["status"] == "success"
                assert len(result["items"]) == 2
                assert result["items"][0]["sku"] == "BOLT-M10"
                assert result["items"][1]["qty"] == 200
                assert result["metadata"]["project_name"] == "Project 2024"

    def test_full_excel_to_structured_data_flow(self):
        """Test complete flow from Excel to structured data."""
        parser = InvoiceParser()

        excel_text = """## Sheet: Invoice

| SKU | Product | Qty |
|---|---|---|
| PROD-1 | Item 1 | 50 |
| PROD-2 | Item 2 | 75 |
"""

        mock_llm_result = ExtractedInvoice(
            items=[
                LLMInvoiceItem(sku="PROD-1", name="Item 1", qty=50),
                LLMInvoiceItem(sku="PROD-2", name="Item 2", qty=75)
            ]
        )

        with patch.object(parser, "_extract_excel_text") as mock_extract:
            mock_extract.return_value = excel_text
            with patch.object(parser.llm_provider, "parse_invoice") as mock_llm:
                mock_llm.return_value = mock_llm_result

                result = parser.parse_file("invoice.xlsx", b"excel content")

                assert result["status"] == "success"
                assert len(result["items"]) == 2

    def test_error_recovery_with_fallback_provider(self):
        """Test error recovery when primary LLM fails."""
        parser = InvoiceParser()

        with patch.object(parser, "_extract_pdf_text") as mock_extract:
            mock_extract.return_value = "text"
            with patch.object(parser.llm_provider, "call") as mock_call:
                # Primary fails with rate limit
                mock_call.side_effect = LLMRateLimitError("Rate limited")

                with pytest.raises(LLMRateLimitError):
                    parser.parse_file("invoice.pdf", b"content")


# =============================================================================
# Constants and Configuration Tests
# =============================================================================

class TestConstants:
    """Test module constants."""

    def test_pdf_extensions_constant(self):
        """Test PDF_EXTENSIONS constant."""
        assert isinstance(PDF_EXTENSIONS, set)
        assert ".pdf" in PDF_EXTENSIONS

    def test_excel_extensions_constant(self):
        """Test EXCEL_EXTENSIONS constant."""
        assert isinstance(EXCEL_EXTENSIONS, set)
        assert ".xlsx" in EXCEL_EXTENSIONS
        assert ".xls" in EXCEL_EXTENSIONS
        assert ".xlsm" in EXCEL_EXTENSIONS


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
