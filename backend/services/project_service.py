"""
Project service — business logic for creating projects from BOM data.

Extracted from tasks.py process_bom_to_project to follow Clean Architecture:
the task is now a thin orchestrator, and all domain logic lives here.
"""

from __future__ import annotations

import logging
import os
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.models import Project, ProjectItem
from backend.services import stock_service

logger = logging.getLogger(__name__)


def create_project_from_bom(
    db: Session,
    items: List[dict],
    metadata: dict,
    file_path: str,
) -> Tuple[Project, int, int]:
    """
    Create a Project with ProjectItems from a parsed BOM.

    This is the core domain operation that was previously embedded in
    the Celery task.  It handles:

    1. Resolving/creating suppliers
    2. Creating the Project record
    3. Creating ProjectItem records for each extracted BOM item
    4. Reserving stock for the created items

    Args:
        db: Active SQLAlchemy session (caller manages lifecycle).
        items: List of dicts with keys: sku, name, qty, supplier.
        metadata: Dict with optional keys: project_name, client.
        file_path: Original Excel file path (used for fallback project name).

    Returns:
        Tuple of (Project, items_created_count, reserved_count).
    """
    from backend.supplier_resolver import find_or_create_supplier

    # Step 1: Resolve suppliers (auto-create if needed)
    supplier_map: dict[str, int] = {}
    unique_suppliers = {item.get('supplier') for item in items if item.get('supplier')}

    for supplier_name in unique_suppliers:
        supplier_id = find_or_create_supplier(db, supplier_name)
        if supplier_id:
            supplier_map[supplier_name] = supplier_id
            logger.info("Resolved supplier '%s' -> ID %d", supplier_name, supplier_id)
        else:
            logger.warning("Failed to resolve supplier '%s'", supplier_name)

    # Step 2: Create Project record
    file_stem = os.path.splitext(os.path.basename(file_path))[0]
    project_name = metadata.get('project_name') or file_stem
    client = metadata.get('client') or 'Не указан'

    project = Project(
        name=project_name,
        client=client,
        status='Проектирование',
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    logger.info(
        "Created project '%s' (ID: %d, client: %s)",
        project_name, project.id, client,
    )

    # Step 3: Create ProjectItem records
    items_created = 0
    for item in items:
        supplier_name = item.get('supplier')
        supplier_id = supplier_map.get(supplier_name) if supplier_name else None

        project_item = ProjectItem(
            project_id=project.id,
            name=item.get('name'),
            sku=item.get('sku'),
            qty=item.get('qty'),
            supplier_id=supplier_id,
            status='К закупке',
        )
        db.add(project_item)
        items_created += 1

    db.commit()
    logger.info("Created %d ProjectItem records", items_created)

    # Step 4: Reserve stock for created ProjectItems
    stock_service.reserve_for_project(project.id, db)
    db.commit()

    reserved_count = db.query(ProjectItem).filter(
        ProjectItem.project_id == project.id,
        ProjectItem.stock_item_id.isnot(None),
    ).count()

    logger.info(
        "Reserved stock for %d items in project %d",
        reserved_count, project.id,
    )

    return project, items_created, reserved_count
