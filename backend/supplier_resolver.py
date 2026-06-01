"""
Supplier Resolver Module for BOM ingestion.

Bridges AI-extracted supplier names (strings) to database supplier_id (integers).
Finds existing suppliers by name or auto-creates them with placeholder email addresses.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from slugify import slugify

# Handle both cases: when backend is a package and when running directly
try:
    from backend.models import Supplier
except ImportError:
    from models import Supplier


logger = logging.getLogger(__name__)

PLACEHOLDER_DOMAIN = "placeholder.com"


def find_or_create_supplier(db: Session, name: str) -> Optional[int]:
    """
    Find existing supplier by exact name match or create a new one.

    Args:
        db: SQLAlchemy database session
        name: Supplier name from AI extraction (case-sensitive exact match)

    Returns:
        supplier_id (int) if found or created successfully
        None if database operation fails

    Example:
        >>> supplier_id = find_or_create_supplier(db, "ООО Вектор")
        >>> # Returns existing ID or creates new supplier with auto-ooo-vector@placeholder.com
    """
    if not name or not name.strip():
        logger.warning("Empty supplier name provided, returning None")
        return None

    # Normalize: strip whitespace but preserve case for exact match
    clean_name = name.strip()

    # Query existing supplier by exact name match (case-sensitive)
    existing = db.query(Supplier).filter(Supplier.name == clean_name).first()

    if existing:
        logger.info(f"Found existing supplier: {existing.name} (ID: {existing.id})")
        return existing.id

    # Create new supplier with placeholder email
    email_slug = slugify(clean_name, separator="-", lowercase=True)
    placeholder_email = f"auto-{email_slug}@{PLACEHOLDER_DOMAIN}"

    try:
        new_supplier = Supplier(
            name=clean_name,
            email=placeholder_email
        )
        db.add(new_supplier)
        db.commit()
        db.refresh(new_supplier)

        logger.info(
            f"Created new supplier: {new_supplier.name} (ID: {new_supplier.id}, "
            f"email: {placeholder_email})"
        )
        return new_supplier.id

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create supplier '{clean_name}': {e}")
        return None


def find_supplier_by_name(db: Session, name: str) -> Optional[int]:
    """
    Find existing supplier by exact name match without auto-creation.

    Args:
        db: SQLAlchemy database session
        name: Supplier name (case-sensitive exact match)

    Returns:
        supplier_id (int) if found, None otherwise
    """
    if not name or not name.strip():
        return None

    clean_name = name.strip()
    supplier = db.query(Supplier).filter(Supplier.name == clean_name).first()

    return supplier.id if supplier else None
