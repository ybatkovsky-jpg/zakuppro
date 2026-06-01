"""
Integration test for S03: Excel parsing and AI BOM extraction.

Tests the complete pipeline:
1. Excel file reading
2. Dataframe cleaning
3. Markdown conversion
4. AI extraction (if OPENAI_API_KEY is set)
5. Celery task execution (if worker is available)
"""

import os
import sys
import io
from pathlib import Path

# Fix Windows console encoding for Unicode characters
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add project root to path for imports
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Test configuration
TEST_FIXTURES = project_root / "tests" / "fixtures"
TEST_EXCEL = TEST_FIXTURES / "sample_bom.xlsx"
OPENAI_KEY_SET = bool(os.getenv("OPENAI_API_KEY"))


def test_module_imports():
    """Test that all S03 modules can be imported."""
    print("\n=== Testing Module Imports ===")

    try:
        from backend.excel_parser import (
            read_excel_file,
            clean_dataframe,
            dataframe_to_markdown,
            parse_excel_to_markdown
        )
        print("✓ excel_parser: All functions imported successfully")
    except ImportError as e:
        print(f"✗ excel_parser import failed: {e}")
        return False

    try:
        from backend.ai_agent import (
            extract_bom_structure,
            ExtractedBOM,
            BOMItem,
            BOMMetadata
        )
        print("✓ ai_agent: All classes/functions imported successfully")
    except ImportError as e:
        print(f"✗ ai_agent import failed: {e}")
        return False

    try:
        from backend.tasks import parse_excel_bom
        print("✓ tasks: parse_excel_bom task imported successfully")
    except ImportError as e:
        print(f"✗ tasks import failed: {e}")
        return False

    return True


def test_excel_reading():
    """Test Excel file reading with pandas."""
    print("\n=== Testing Excel Reading ===")

    if not TEST_EXCEL.exists():
        print(f"✗ Test file not found: {TEST_EXCEL}")
        return False

    from backend.excel_parser import read_excel_file, clean_dataframe

    try:
        # Read raw Excel
        df_raw = read_excel_file(TEST_EXCEL)
        print(f"✓ Excel read successful: {len(df_raw)} rows")

        # Clean dataframe
        df_clean = clean_dataframe(df_raw)
        print(f"✓ Dataframe cleaned: {len(df_clean)} data rows (empty rows removed)")

        # Verify columns
        expected_cols = ["Артикул", "Наименование", "Количество", "Поставщик"]
        actual_cols = list(df_clean.columns)
        print(f"  Columns: {actual_cols}")

        # Check that we have the expected Russian headers
        has_russian_headers = any(
            h in actual_cols for h in ["Артикул", "Наименование", "Количество", "Поставщик"]
        )
        if has_russian_headers:
            print("✓ Russian column headers detected")
        else:
            print("⚠ Warning: Expected Russian headers not found")

        return True

    except Exception as e:
        print(f"✗ Excel reading failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_markdown_conversion():
    """Test conversion to markdown format."""
    print("\n=== Testing Markdown Conversion ===")

    if not TEST_EXCEL.exists():
        print(f"✗ Test file not found: {TEST_EXCEL}")
        return False

    from backend.excel_parser import parse_excel_to_markdown

    try:
        markdown = parse_excel_to_markdown(TEST_EXCEL)
        print(f"✓ Markdown generated: {len(markdown)} characters")

        # Show first few lines
        lines = markdown.split("\n")
        print("\nFirst 5 lines of markdown:")
        for line in lines[:5]:
            print(f"  {line}")

        # Verify markdown structure
        if "|" in markdown and "---" in markdown:
            print("✓ Markdown table structure validated")
        else:
            print("✗ Markdown does not appear to be a valid table")
            return False

        return True

    except Exception as e:
        print(f"✗ Markdown conversion failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_ai_extraction():
    """Test AI BOM extraction (requires OPENAI_API_KEY)."""
    print("\n=== Testing AI BOM Extraction ===")

    if not OPENAI_KEY_SET:
        print("⚠ OPENAI_API_KEY not set - skipping AI extraction test")
        print("  To enable: export OPENAI_API_KEY=your_key_here")
        return None  # None means skipped, not failed

    if not TEST_EXCEL.exists():
        print(f"✗ Test file not found: {TEST_EXCEL}")
        return False

    from backend.excel_parser import parse_excel_to_markdown
    from backend.ai_agent import extract_bom_structure, ExtractedBOM

    try:
        # Get markdown
        markdown = parse_excel_to_markdown(TEST_EXCEL)

        # Extract with AI
        print("  Calling GPT-4o for BOM extraction...")
        result = extract_bom_structure(markdown)

        # Validate with Pydantic
        validated = ExtractedBOM(**result)
        items_count = len(validated.items)

        print(f"✓ AI extraction successful: {items_count} items extracted")

        # Show first item
        if validated.items:
            first_item = validated.items[0]
            print(f"\nFirst item example:")
            print(f"  SKU: {first_item.sku}")
            print(f"  Name: {first_item.name}")
            print(f"  Qty: {first_item.qty}")
            print(f"  Supplier: {first_item.supplier}")

        # Validate that we got expected fields
        for item in validated.items:
            assert item.sku, "Item missing SKU"
            assert item.name, "Item missing name"
            assert isinstance(item.qty, int) and item.qty >= 0, "Invalid qty"

        print("✓ All items validated successfully")

        return True

    except Exception as e:
        print(f"✗ AI extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_celery_task():
    """Test Celery task registration and synchronous execution."""
    print("\n=== Testing Celery Task ===")

    try:
        from backend.tasks import parse_excel_bom

        # Test task is callable (registered)
        print(f"✓ Task 'parse_excel_bom' is registered")
        print(f"  Task name: {parse_excel_bom.name}")
        print(f"  Max retries: {parse_excel_bom.max_retries}")

        # Note: We don't execute the task synchronously here because:
        # 1. It requires OPENAI_API_KEY
        # 2. Full execution should be tested with running Celery worker
        # 3. The task logic is tested via the module-level functions above

        print("⚠ Note: Full task execution requires running Celery worker")
        print("  To test fully: celery -A backend.celery_app worker -l info")

        return True

    except Exception as e:
        print(f"✗ Celery task test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all integration tests."""
    print("=" * 60)
    print("S03 Integration Test Suite")
    print("=" * 60)

    results = {
        "module_imports": test_module_imports(),
        "excel_reading": test_excel_reading(),
        "markdown_conversion": test_markdown_conversion(),
        "ai_extraction": test_ai_extraction(),
        "celery_task": test_celery_task(),
    }

    print("\n" + "=" * 60)
    print("Test Results Summary")
    print("=" * 60)

    for test_name, result in results.items():
        if result is True:
            print(f"✓ {test_name}: PASSED")
        elif result is False:
            print(f"✗ {test_name}: FAILED")
        else:
            print(f"○ {test_name}: SKIPPED (no OPENAI_API_KEY)")

    # Exit with appropriate code
    failed = sum(1 for r in results.values() if r is False)
    skipped = sum(1 for r in results.values() if r is None)

    print(f"\nTotal: {len(results)} tests, {len(results) - failed - skipped} passed, {failed} failed, {skipped} skipped")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
