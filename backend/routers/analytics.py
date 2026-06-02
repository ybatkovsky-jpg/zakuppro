"""
Analytics router for ZakupPro API.
Provides endpoints for dashboard metrics, payment dynamics, and export functionality.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, select
from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal
import logging

from backend.database import get_db
from backend.models import Invoice, Payment
from backend.schemas import DashboardMetricsResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(
    period_start: Optional[datetime] = Query(None, description="Filter invoices from this date (inclusive)"),
    period_end: Optional[datetime] = Query(None, description="Filter invoices until this date (inclusive)"),
    db: Session = Depends(get_db)
):
    """
    Get dashboard metrics for financial visibility.

    Returns aggregated metrics:
    - paid_invoices_count: Number of invoices with status 'Оплачен'
    - unpaid_invoices_count: Number of invoices with status in ('Ожидает сверки', 'Ошибки', 'Ожидает оплаты')
    - total_paid_amount: Sum of all payments made
    - total_unpaid_amount: Sum of invoice totals for unpaid invoices
    - pending_invoices_count: Number of invoices with status 'Сверен'

    Filters:
    - period_start: Optional start date for filtering invoices/payments (inclusive)
    - period_end: Optional end date for filtering invoices/payments (inclusive)
    - If no date range provided, defaults to last 30 days

    Date range validation:
    - Maximum range is 1 year (365 days)
    - period_start must be before period_end

    Uses SQLAlchemy aggregations (func.count(), func.sum()) for efficient queries.
    Includes structured logging for filter parameters and result counts.
    """
    logger.info(
        "get_dashboard_metrics called with filters: period_start=%s, period_end=%s",
        period_start, period_end
    )

    # Default to last 30 days if no date range specified
    if period_start is None and period_end is None:
        period_end = datetime.utcnow()
        period_start = period_end - timedelta(days=30)
        logger.debug(f"Defaulted to last 30 days: {period_start} to {period_end}")
    elif period_start is None or period_end is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both period_start and period_end must be provided together"
        )

    # Validate date range max 1 year
    if period_start and period_end:
        date_range = (period_end - period_start).days
        if date_range > 365:
            logger.warning(f"Date range exceeds 1 year: {date_range} days")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Date range exceeds maximum of 1 year (365 days). Got {date_range} days."
            )
        if period_start >= period_end:
            logger.warning(f"Invalid date range: period_start ({period_start}) >= period_end ({period_end})")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="period_start must be before period_end"
            )

    logger.debug(f"Using date range: {period_start} to {period_end}")

    # Base query for invoices within date range
    invoice_query = db.query(Invoice).filter(
        and_(
            Invoice.created_at >= period_start,
            Invoice.created_at <= period_end
        )
    )

    # Count paid invoices (status 'Оплачен')
    paid_invoices_count = (
        invoice_query.filter(Invoice.status == "Оплачен").count()
    )
    logger.debug(f"paid_invoices_count: {paid_invoices_count}")

    # Count unpaid invoices (statuses that indicate not yet paid)
    unpaid_statuses = ["Ожидает сверки", "Ошибки", "Ожидает оплаты"]
    unpaid_invoices_count = (
        invoice_query.filter(Invoice.status.in_(unpaid_statuses)).count()
    )
    logger.debug(f"unpaid_invoices_count: {unpaid_invoices_count}")

    # Count pending invoices (status 'Сверен')
    pending_invoices_count = (
        invoice_query.filter(Invoice.status == "Сверен").count()
    )
    logger.debug(f"pending_invoices_count: {pending_invoices_count}")

    # Calculate total paid amount from Payment records
    payment_query = db.query(Payment).filter(
        and_(
            Payment.payment_date >= period_start,
            Payment.payment_date <= period_end
        )
    )
    total_paid_result = payment_query.with_entities(
        func.sum(Payment.amount)
    ).scalar()
    total_paid_amount = float(total_paid_result) if total_paid_result is not None else 0.0
    logger.debug(f"total_paid_amount: {total_paid_amount}")

    # Calculate total unpaid amount from invoice items for unpaid invoices
    # Sum of (qty * unit_price) for all items in unpaid invoices
    from backend.models import InvoiceItem

    unpaid_invoice_ids_subquery = (
        select(Invoice.id)
        .where(
            and_(
                Invoice.created_at >= period_start,
                Invoice.created_at <= period_end,
                Invoice.status.in_(unpaid_statuses)
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
    logger.debug(f"total_unpaid_amount: {total_unpaid_amount}")

    metrics = DashboardMetricsResponse(
        paid_invoices_count=paid_invoices_count,
        unpaid_invoices_count=unpaid_invoices_count,
        total_paid_amount=total_paid_amount,
        total_unpaid_amount=total_unpaid_amount,
        pending_invoices_count=pending_invoices_count,
        period_start=period_start,
        period_end=period_end
    )

    logger.info(
        f"Dashboard metrics: paid={paid_invoices_count}, unpaid={unpaid_invoices_count}, "
        f"paid_amount={total_paid_amount}, unpaid_amount={total_unpaid_amount}, "
        f"pending={pending_invoices_count}"
    )

    return metrics
