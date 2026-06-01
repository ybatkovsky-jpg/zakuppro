@echo off
REM Verification script for S03: Excel parsing and AI BOM extraction (Windows)

echo ===================================================
echo S03 Slice Verification: File Structure Check
echo ===================================================

set EXIT_CODE=0

REM Check test Excel file
echo.
echo === Checking Test Excel File ===
if exist "tests\fixtures\sample_bom.xlsx" (
    echo [OK] Test Excel file exists: tests\fixtures\sample_bom.xlsx
) else (
    echo [FAIL] Test Excel file missing: tests\fixtures\sample_bom.xlsx
    set EXIT_CODE=1
)

REM Check backend code files exist
echo.
echo === Checking Backend Code Files ===

for %%F in (backend\excel_parser.py backend\ai_agent.py backend\tasks.py backend\celery_app.py backend\tests\test_s03_integration.py) do (
    if exist "%%F" (
        echo [OK] %%F
    ) else (
        echo [FAIL] %%F missing
        set EXIT_CODE=1
    )
)

REM Check Python syntax
echo.
echo === Checking Python Syntax ===

for %%F in (backend\excel_parser.py backend\ai_agent.py backend\tasks.py backend\celery_app.py backend\tests\test_s03_integration.py) do (
    python -m py_compile "%%F" 2>nul
    if errorlevel 1 (
        echo [FAIL] %%F has syntax errors
        python -m py_compile "%%F"
        set EXIT_CODE=1
    ) else (
        echo [OK] %%F syntax OK
    )
)

REM Check test Excel content
echo.
echo === Checking Test Excel Content ===

python -c "import openpyxl; wb = openpyxl.load_workbook('tests/fixtures/sample_bom.xlsx'); ws = wb.active; headers = [c.value for c in ws[1]]; print('Headers:', headers); data_rows = sum(1 for r in ws.iter_rows(min_row=2) if any(c.value for c in r)); print('Data rows:', data_rows); russian = ['Артикул', 'Наименование', 'Количество', 'Поставщик']; print('[OK] Russian headers detected' if any(h in headers for h in russian) else '[FAIL] Russian headers not found')" 2>nul

if errorlevel 1 (
    echo [FAIL] Error checking Excel content
    set EXIT_CODE=1
)

echo.
if %EXIT_CODE% equ 0 (
    echo ===================================================
    echo S03 Verification PASSED
    echo ===================================================
) else (
    echo ===================================================
    echo S03 Verification FAILED
    echo ===================================================
)

echo.
echo Note: Full integration tests require dependencies.
echo To run with Docker:
echo   docker-compose build celery-worker
echo   docker-compose run --rm celery-worker python -m backend.tests.test_s03_integration
echo.
echo Or install dependencies locally:
echo   pip install -r backend\requirements.txt
echo   python backend\tests\test_s03_integration.py

exit /b %EXIT_CODE%
