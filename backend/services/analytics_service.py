"""
Analytics service — business logic for dashboard metrics, payment dynamics,
and data export.

Extracted from routers/analytics.py to follow Clean Architecture:
the router handles HTTP concerns only, and all domain logic lives here.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List

import pandas as pd
from sqlalchemy import func, and_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from backend.models import (
    Invoice, InvoiceItem, Payment, Supplier, Project, PurchaseOrder,
    BankStatement, BankTransaction,
)
from backend.rbac import Role, apply_ownership_filter
from backend.schemas import (
    DashboardMetricsResponse,
    PaymentDynamicsPoint,
)

logger = logging.getLogger(__name__)

# Unpaid invoice statuses
UNPAID_STATUSES = ["Ожидает сверки", "Ошибки", "Ожидает оплаты"]


def compute_dashboard_metrics(
    db: Session,
    period_start: datetime,
    period_end: datetime,
    user_id: int,
    user_role: Role,
) -> DashboardMetricsResponse:
    """
    Compute aggregated dashboard metrics for the given date range.

    Args:
        db: SQLAlchemy session.
        period_start: Start of the date range (inclusive).
        period_end: End of the date range (inclusive).
        user_id: Current user ID for ownership filtering.
        user_role: Current user role for ownership filtering.

    Returns:
        DashboardMetricsResponse with counts and amounts.
    """
    # Base query for invoices within date range
    invoice_query = db.query(Invoice).filter(
        and_(
            Invoice.created_at >= period_start,
            Invoice.created_at <= period_end,
        )
    )

    # Apply ownership filter for managers
    invoice_query = apply_ownership_filter(
        invoice_query.join(Invoice.purchase_order).join(PurchaseOrder.project),
        Project,
        user_id,
        user_role,
    )

    # Count paid invoices
    paid_invoices_count = invoice_query.filter(Invoice.status == "Оплачен").count()

    # Count unpaid invoices
    unpaid_invoices_count = (
        invoice_query.filter(Invoice.status.in_(UNPAID_STATUSES)).count()
    )

    # Count pending invoices (verified but not yet paid)
    pending_invoices_count = invoice_query.filter(Invoice.status == "Сверен").count()

    # Total paid amount from Payment records
    payment_query = db.query(Payment).filter(
        and_(
            Payment.payment_date >= period_start,
            Payment.payment_date <= period_end,
        )
    )
    payment_query = apply_ownership_filter(
        payment_query.join(Payment.invoice).join(Invoice.purchase_order).join(PurchaseOrder.project),
        Project,
        user_id,
        user_role,
    )
    total_paid_result = payment_query.with_entities(func.sum(Payment.amount)).scalar()
    total_paid_amount = float(total_paid_result) if total_paid_result is not None else 0.0

    # Total unpaid amount from invoice items
    unpaid_invoice_ids_subquery = (
        select(Invoice.id)
        .where(
            and_(
                Invoice.created_at >= period_start,
                Invoice.created_at <= period_end,
                Invoice.status.in_(UNPAID_STATUSES),
            )
        )
        .scalar_subquery()
    )
    total_unpaid_result = (
        db.query(func.sum(InvoiceItem.total_price))
        .filter(InvoiceItem.invoice_id.in_(unpaid_invoice_ids_subquery))
        .scalar()
    )
    total_unpaid_amount = float(total_unpaid_result) if total_unpaid_result is not None else 0.0

    return DashboardMetricsResponse(
        paid_invoices_count=paid_invoices_count,
        unpaid_invoices_count=unpaid_invoices_count,
        total_paid_amount=total_paid_amount,
        total_unpaid_amount=total_unpaid_amount,
        pending_invoices_count=pending_invoices_count,
        period_start=period_start,
        period_end=period_end,
    )


def compute_payment_dynamics(
    db: Session,
    period_start: datetime,
    period_end: datetime,
    group_by: str,
    user_id: int,
    user_role: Role,
) -> tuple[list[PaymentDynamicsPoint], float, int]:
    """
    Compute payment dynamics time-series data grouped by day/week/month.

    Returns:
        Tuple of (data_points, total_amount, total_count).
    """
    # Detect database dialect for date truncation
    dialect_name = db.bind.dialect.name if hasattr(db.bind, 'dialect') else 'sqlite'

    date_trunc_expr = _build_date_trunc_expr(dialect_name, group_by)

    # Build base payment query with ownership filter
    base_payment_query = db.query(Payment).filter(
        and_(
            Payment.payment_date >= period_start,
            Payment.payment_date <= period_end,
        )
    )
    base_payment_query = apply_ownership_filter(
        base_payment_query.join(Payment.invoice).join(Invoice.purchase_order).join(PurchaseOrder.project),
        Project,
        user_id,
        user_role,
    )

    # Aggregation query
    payment_query = (
        base_payment_query.with_entities(
            date_trunc_expr.label("period"),
            func.sum(Payment.amount).label("paid_amount"),
            func.count(Payment.id).label("paid_count"),
        )
        .group_by("period")
        .order_by("period")
    )

    results = payment_query.all()

    data_points = []
    total_amount = 0.0
    total_count = 0

    for row in results:
        period_date = _parse_period_date(row.period, group_by, period_start)
        paid_amount = float(row.paid_amount) if row.paid_amount is not None else 0.0
        paid_count = row.paid_count if row.paid_count is not None else 0

        data_points.append(PaymentDynamicsPoint(
            date=period_date,
            paid_amount=paid_amount,
            paid_count=paid_count,
        ))
        total_amount += paid_amount
        total_count += paid_count

    return data_points, total_amount, total_count


def export_transactions_to_excel(
    db: Session,
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    limit: int,
) -> bytes:
    """
    Export payment transactions to Excel format.

    Returns:
        Bytes of the .xlsx file content.
    """
    query = (
        db.query(Payment)
        .options(
            joinedload(Payment.invoice)
            .joinedload(Invoice.purchase_order)
            .selectinload(PurchaseOrder.supplier),
            joinedload(Payment.invoice)
            .joinedload(Invoice.purchase_order)
            .selectinload(PurchaseOrder.project),
        )
    )

    if date_from:
        query = query.filter(Payment.payment_date >= date_from)
    if date_to:
        query = query.filter(Payment.payment_date <= date_to)

    query = query.order_by(Payment.payment_date.desc()).limit(limit)
    payments = query.all()

    data = []
    for payment in payments:
        invoice = payment.invoice
        supplier_name = None
        project_name = None
        description = None

        if invoice and invoice.purchase_order:
            if invoice.purchase_order.supplier:
                supplier_name = invoice.purchase_order.supplier.name
            if invoice.purchase_order.project:
                project_name = invoice.purchase_order.project.name
            description = invoice.status

        data.append({
            "date": payment.payment_date.strftime("%Y-%m-%d") if payment.payment_date else "",
            "amount": float(payment.amount) if payment.amount else 0.0,
            "invoice_id": payment.invoice_id,
            "supplier": supplier_name or "",
            "project": project_name or "",
            "description": description or "",
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Transactions")
    output.seek(0)

    logger.info("Excel export: %d rows, date_range=%s to %s", len(payments), date_from, date_to)
    return output.read()


# ---------------------------------------------------------------------------
# Helpers (private)
# ---------------------------------------------------------------------------

def _build_date_trunc_expr(dialect_name: str, group_by: str):
    """Build the SQLAlchemy date truncation expression for the given dialect."""
    if dialect_name == 'postgresql':
        mapping = {"day": "day", "week": "week", "month": "month"}
        return func.date_trunc(mapping.get(group_by, "day"), Payment.payment_date)
    else:
        # SQLite / others — use strftime
        if group_by == "day":
            return func.strftime("%Y-%m-%d", Payment.payment_date)
        elif group_by == "week":
            return func.strftime("%Y-W%W", Payment.payment_date)
        else:
            return func.strftime("%Y-%m", Payment.payment_date)


def _parse_period_date(period_value, group_by: str, fallback: datetime) -> datetime:
    """Parse a period value (datetime or string) from the database into a datetime."""
    if isinstance(period_value, datetime):
        return period_value
    elif isinstance(period_value, str):
        try:
            if group_by == "day":
                return datetime.strptime(period_value, "%Y-%m-%d")
            elif group_by == "month":
                return datetime.strptime(period_value, "%Y-%m")
            elif group_by == "week":
                year, week = period_value.split("-W")
                return datetime.strptime(f"{year}-W{week}-1", "%Y-W%W-%w")
        except (ValueError, IndexError):
            pass
    return fallback
