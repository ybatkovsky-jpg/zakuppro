"""
Excel parser module for dirty invoice tables.

Reads Excel files with pandas/openpyxl, handles common dirty patterns:
- Merged cells
- Empty rows/columns
- Multi-line headers
- Extra whitespace

Outputs clean markdown tables for AI processing.
"""

from __future__ import annotations

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional


def read_excel_file(path: str | Path, engine: str = "openpyxl") -> pd.DataFrame:
    """
    Read Excel file with openpyxl engine.

    Args:
        path: Path to Excel file (.xlsx, .xlsm)
        engine: Excel engine (default: openpyxl)

    Returns:
        Raw DataFrame with all rows including potential header noise

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If file is empty or invalid
    """
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Excel file not found: {path}")

    # Read without header detection - get raw data
    # Use data_only=True to read computed values instead of formulas
    # (e.g., =G3*H3 becomes the actual number like 15249)
    try:
        df = pd.read_excel(path, engine=engine, header=None)
    except Exception:
        # Fallback: try reading with data_only via openpyxl directly
        import openpyxl
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.active
        data = []
        for row in ws.iter_rows(values_only=True):
            data.append(row)
        df = pd.DataFrame(data)

    if df.empty:
        raise ValueError(f"Excel file is empty: {path}")

    return df


def detect_header_row(df: pd.DataFrame, max_search_rows: int = 10) -> int:
    """
    Find the first row that looks like a header.

    A header row is defined as:
    - Not all NaN values
    - Contains at least 2 non-empty string values
    - Not primarily numeric (likely data, not headers)

    Args:
        df: Raw DataFrame
        max_search_rows: Maximum rows to search for header

    Returns:
        Zero-based row index of the header row
    """
    for idx in range(min(len(df), max_search_rows)):
        row = df.iloc[idx]

        # Skip completely empty rows
        if row.isna().all():
            continue

        # Count non-empty string values
        non_empty = row.dropna()
        string_count = 0
        numeric_count = 0
        for v in non_empty:
            if isinstance(v, str):
                if v.strip():
                    string_count += 1
            elif isinstance(v, (int, float, np.integer, np.floating)):
                numeric_count += 1

        # Header candidate: at least 2 strings and not mostly numbers
        if string_count >= 2 and string_count >= numeric_count:
            return idx

    # Fallback: first non-empty row
    for idx in range(len(df)):
        if not df.iloc[idx].isna().all():
            return idx

    return 0


def clean_dataframe(df: pd.DataFrame, header_row: Optional[int] = None) -> pd.DataFrame:
    """
    Clean DataFrame by removing empty rows/columns and normalizing text.

    Args:
        df: Raw DataFrame
        header_row: Optional row index to use as header (auto-detect if None)

    Returns:
        Cleaned DataFrame with proper header and no empty rows/columns
    """
    if df.empty:
        return df

    result = df.copy()

    # Detect and set header row if not provided
    if header_row is None:
        header_row = detect_header_row(result)

    # Set header row
    if header_row > 0:
        result.columns = result.iloc[header_row]
        result = result.iloc[header_row + 1:].reset_index(drop=True)
    else:
        result.columns = result.iloc[0]
        result = result.iloc[1:].reset_index(drop=True)

    # Convert columns to strings and strip whitespace
    result.columns = [str(c).strip() if pd.notna(c) else f"col_{i}"
                      for i, c in enumerate(result.columns)]

    # Drop completely empty rows
    result = result.dropna(how="all")

    # Drop completely empty columns
    result = result.dropna(axis=1, how="all")

    # Strip whitespace from string values in all columns
    for col in result.columns:
        if result[col].dtype == "object":
            result[col] = result[col].apply(
                lambda x: x.strip() if isinstance(x, str) else x
            )

    # Replace NaN with empty string for cleaner output
    result = result.fillna("")

    # Drop rows where all values are empty strings (after stripping)
    result = result[~result.apply(lambda row: all(str(v).strip() == "" for v in row), axis=1)]

    return result.reset_index(drop=True)


def dataframe_to_markdown(df: pd.DataFrame, max_rows: Optional[int] = None) -> str:
    """
    Convert DataFrame to markdown table format.

    Args:
        df: Cleaned DataFrame
        max_rows: Optional row limit (None for all rows)

    Returns:
        Markdown table string with header separator row
    """
    if df.empty:
        return "| Empty table |\n|---|"

    # Limit rows if specified
    if max_rows:
        display_df = df.head(max_rows)
    else:
        display_df = df

    # Convert to markdown
    md_lines = []

    # Header row
    headers = [str(c) for c in display_df.columns]
    md_lines.append("| " + " | ".join(headers) + " |")
    md_lines.append("|" + "|".join(["---"] * len(headers)) + "|")

    # Data rows
    for _, row in display_df.iterrows():
        values = [str(v).replace("|", "\\|") for v in row]  # Escape pipe chars
        md_lines.append("| " + " | ".join(values) + " |")

    return "\n".join(md_lines)


def dataframe_to_csv(df: pd.DataFrame) -> str:
    """
    Convert DataFrame to CSV format (alternative to markdown).

    Args:
        df: Cleaned DataFrame

    Returns:
        CSV string with header row
    """
    return df.to_csv(index=False)


def parse_excel_to_markdown(path: str | Path, max_rows: Optional[int] = None) -> str:
    """
    Convenience function: read, clean, and convert Excel to markdown.

    Args:
        path: Path to Excel file
        max_rows: Optional row limit for output

    Returns:
        Markdown table string ready for AI processing
    """
    df = read_excel_file(path)
    header_idx = detect_header_row(df)
    clean_df = clean_dataframe(df, header_idx)
    return dataframe_to_markdown(clean_df, max_rows=max_rows)
