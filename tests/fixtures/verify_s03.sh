#!/bin/bash
# Verification script for S03: Excel parsing and AI BOM extraction
# This script validates the slice without requiring dependencies to be installed

set -e

echo "==================================================="
echo "S03 Slice Verification: File Structure Check"
echo "==================================================="

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check test Excel file
echo ""
echo "=== Checking Test Excel File ==="
if [ -f "tests/fixtures/sample_bom.xlsx" ]; then
    echo -e "${GREEN}✓${NC} Test Excel file exists: tests/fixtures/sample_bom.xlsx"
    file_size=$(stat -c%s "tests/fixtures/sample_bom.xlsx" 2>/dev/null || stat -f%z "tests/fixtures/sample_bom.xlsx")
    echo "  File size: $file_size bytes"
else
    echo -e "${RED}✗${NC} Test Excel file missing: tests/fixtures/sample_bom.xlsx"
    exit 1
fi

# Check backend code files exist
echo ""
echo "=== Checking Backend Code Files ==="

files=(
    "backend/excel_parser.py"
    "backend/ai_agent.py"
    "backend/tasks.py"
    "backend/celery_app.py"
    "backend/tests/test_s03_integration.py"
)

all_files_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file missing"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = false ]; then
    exit 1
fi

# Check Python syntax without importing
echo ""
echo "=== Checking Python Syntax ==="

for file in backend/excel_parser.py backend/ai_agent.py backend/tasks.py backend/celery_app.py backend/tests/test_s03_integration.py; do
    if python -m py_compile "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $file syntax OK"
    else
        echo -e "${RED}✗${NC} $file has syntax errors"
        python -m py_compile "$file"
        exit 1
    fi
done

# Check that test Excel has expected content using openpyxl
echo ""
echo "=== Checking Test Excel Content ==="

python3 -c "
import sys
sys.path.insert(0, '.')

try:
    import openpyxl
    wb = openpyxl.load_workbook('tests/fixtures/sample_bom.xlsx')
    ws = wb.active

    # Get header row
    headers = [cell.value for cell in ws[1]]
    print(f'Headers: {headers}')

    # Count data rows
    data_rows = sum(1 for row in ws.iter_rows(min_row=2) if any(cell.value for cell in row))
    print(f'Data rows: {data_rows}')

    # Check for Russian headers
    russian_keywords = ['Артикул', 'Наименование', 'Количество', 'Поставщик']
    found_russian = any(h in headers for h in russian_keywords)

    if found_russian:
        print('✓ Russian headers detected')
    else:
        print('✗ Russian headers not found')
        sys.exit(1)

except Exception as e:
    print(f'✗ Error checking Excel: {e}')
    sys.exit(1)
" 2>/dev/null

echo ""
echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}S03 Verification PASSED${NC}"
echo -e "${GREEN}===================================================${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} Full integration tests require dependencies."
echo "To run with all dependencies:"
echo "  docker-compose build celery-worker"
echo "  docker-compose run --rm celery-worker python -m backend.tests.test_s03_integration"
echo ""
echo "Or install dependencies locally:"
echo "  pip install -r backend/requirements.txt"
echo "  python backend/tests/test_s03_integration.py"
