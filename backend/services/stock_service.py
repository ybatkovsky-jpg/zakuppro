"""
Stock service with three core primitives for inventory management.

Enforces the invariant qty_total = qty_reserved + qty_available at the service
layer after every mutation. Provides the single entry point for all stock
mutations: reserve, write-off, and receive.
"""
import logging
from sqlalchemy.orm import Session

from backend.models import ProjectItem, StockItem

logger = logging.getLogger(__name__)


def _validate_invariant(stock_item: StockItem) -> None:
    """Raise ValueError if the stock invariant is violated."""
    expected = stock_item.qty_reserved + stock_item.qty_available
    if stock_item.qty_total != expected:
        raise ValueError(
            f"Stock invariant violated for StockItem {stock_item.id} "
            f"(SKU '{stock_item.sku}'): "
            f"qty_total={stock_item.qty_total} != "
            f"qty_reserved={stock_item.qty_reserved} + "
            f"qty_available={stock_item.qty_available} = {expected}"
        )


def reserve_for_project(project_id: int, db: Session) -> None:
    """
    Reserve stock for all ProjectItems in a project.

    For each ProjectItem with a SKU, finds the matching StockItem by SKU,
    links the ProjectItem to the StockItem if not already linked, and reserves
    up to the needed quantity (full if sufficient, partial otherwise with a
    warning).

    Validates the stock invariant after every reservation.
    """
    project_items = db.query(ProjectItem).filter(
        ProjectItem.project_id == project_id
    ).all()

    for item in project_items:
        if not item.sku:
            continue

        stock_item = db.query(StockItem).filter(
            StockItem.sku == item.sku
        ).first()

        if not stock_item:
            logger.info(
                "reserve_for_project: no StockItem found for SKU '%s' "
                "(project_item_id=%s, project_id=%s)",
                item.sku, item.id, project_id,
            )
            continue

        # Link ProjectItem to StockItem if not already linked
        if item.stock_item_id is None:
            item.stock_item_id = stock_item.id

        needed = item.qty
        available = stock_item.qty_available

        if available >= needed:
            reserve_qty = needed
        else:
            reserve_qty = available
            logger.warning(
                "reserve_for_project: insufficient stock for SKU '%s' — "
                "needed=%s, available=%s, reserving partial=%s. "
                "project_id=%s, project_item_id=%s, stock_item_id=%s",
                item.sku, needed, available, reserve_qty,
                project_id, item.id, stock_item.id,
            )

        if reserve_qty > 0:
            stock_item.qty_reserved += reserve_qty
            stock_item.qty_available -= reserve_qty
            _validate_invariant(stock_item)
            logger.info(
                "reserve_for_project: reserved %s units of SKU '%s' "
                "(stock_item_id=%s) for project_id=%s, project_item_id=%s",
                reserve_qty, stock_item.sku, stock_item.id,
                project_id, item.id,
            )

    db.flush()


def write_off_for_production(project_id: int, db: Session) -> None:
    """
    Write off reserved stock when a project moves to production.

    For every ProjectItem linked to a StockItem (stock_item_id IS NOT NULL),
    decreases both qty_total and qty_reserved on the linked StockItem by the
    ProjectItem.qty. qty_available is unchanged (already reduced by reserve).

    Validates the stock invariant after every write-off.
    """
    project_items = db.query(ProjectItem).filter(
        ProjectItem.project_id == project_id,
        ProjectItem.stock_item_id.isnot(None),
    ).all()

    for item in project_items:
        stock_item = item.stock_item  # eager-loaded via relationship
        if not stock_item:
            continue

        write_off_qty = item.qty
        if write_off_qty <= 0:
            continue

        stock_item.qty_total -= write_off_qty
        stock_item.qty_reserved -= write_off_qty
        _validate_invariant(stock_item)
        logger.info(
            "write_off_for_production: wrote off %s units of SKU '%s' "
            "(stock_item_id=%s) for production of project_id=%s, "
            "project_item_id=%s",
            write_off_qty, stock_item.sku, stock_item.id,
            project_id, item.id,
        )

    db.flush()


def receive_stock(stock_item_id: int, qty: int, db: Session) -> None:
    """
    Receive goods into stock (goods receipt).

    Increases both qty_total and qty_available by the received quantity.
    qty_reserved is unchanged.

    Raises ValueError if the StockItem is not found or the invariant is
    violated after the operation.
    """
    stock_item = db.query(StockItem).filter(
        StockItem.id == stock_item_id
    ).first()

    if not stock_item:
        raise ValueError(f"StockItem with id {stock_item_id} not found")

    stock_item.qty_total += qty
    stock_item.qty_available += qty
    _validate_invariant(stock_item)
    logger.info(
        "receive_stock: received %s units of SKU '%s' (stock_item_id=%s) — "
        "qty_total=%s, qty_reserved=%s, qty_available=%s",
        qty, stock_item.sku, stock_item.id,
        stock_item.qty_total, stock_item.qty_reserved, stock_item.qty_available,
    )

    db.flush()
