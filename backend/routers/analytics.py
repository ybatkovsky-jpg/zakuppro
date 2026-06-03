"""
Analytics router for ZakupPro API.
Provides endpoints for dashboard metrics, payment dynamics, export functionality,
and bank statement upload for manual reconciliation.

RBAC:
- GET /api/analytics/dashboard: owner (all data), manager (own projects only), warehouse (403)
- GET /api/analytics/payment-dynamics: owner (all data), manager (own projects only), warehouse (403)
- GET /api/analytics/export/transactions: owner only
- POST /api/analytics/upload-bank-statement: owner only
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func, and_, or_, select, case, cast, Date
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
import logging
import io

import pandas as pd

from backend.database import get_db
from backend.models import (
    Invoice, Payment, Supplier, Project, PurchaseOrder,
    BankStatement, BankTransaction, User
)
from backend.schemas import (
    DashboardMetricsResponse,
    PaymentDynamicsResponse,
    PaymentDynamicsPoint,
    UploadBankStatementResponse
)
from backend.services.bank_statement_parser import BankStatementParser
from backend.services.payment_matcher import PaymentMatcher
from backend.rbac import require_role, Role, apply_ownership_filter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardMetricsResponse)
def get_dashboard_metrics(
    period_start: Optional[datetime] = Query(None, description="Filter invoices from this date (inclusive)"),
    period_end: Optional[datetime] = Query(None, description="Filter invoices until this date (inclusive)"),
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get dashboard metrics for financial visibility.

    RBAC:
    - Owner: all data (no ownership filter)
    - Manager: only their projects' metrics (filtered by owner_id)

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

    # Apply ownership filter for managers
    invoice_query = apply_ownership_filter(
        invoice_query.join(Invoice.purchase_order).join(PurchaseOrder.project),
        Project,
        current_user.id,
        current_user.role
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

    # Apply ownership filter for managers (payments via invoices)
    payment_query = apply_ownership_filter(
        payment_query.join(Payment.invoice).join(Invoice.purchase_order).join(PurchaseOrder.project),
        Project,
        current_user.id,
        current_user.role
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


@router.get("/payment-dynamics", response_model=PaymentDynamicsResponse)
def get_payment_dynamics(
    period_start: Optional[datetime] = Query(None, description="Filter payments from this date (inclusive)"),
    period_end: Optional[datetime] = Query(None, description="Filter payments until this date (inclusive)"),
    group_by: str = Query("day", description="Grouping period: 'day', 'week', or 'month'"),
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Get payment dynamics time-series data for charts.

    Returns grouped payment data over time with:
    - date: The grouped date bucket
    - paid_amount: Total payment amount in this period
    - paid_count: Number of payments in this period

    Filters:
    - period_start: Optional start date for filtering payments (inclusive)
    - period_end: Optional end date for filtering payments (inclusive)
    - group_by: Grouping period - 'day' (default), 'week', or 'month'

    Date range validation:
    - Maximum range is 1 year (365 days)
    - period_start must be before period_end
    - Default to last 30 days if no date range provided

    Uses SQLAlchemy date_trunc() for grouping by day/week/month.
    Includes structured logging for grouping period and date range.
    """
    logger.info(
        "get_payment_dynamics called with filters: period_start=%s, period_end=%s, group_by=%s",
        period_start, period_end, group_by
    )

    # Validate group_by parameter
    valid_group_by = {"day", "week", "month"}
    if group_by not in valid_group_by:
        logger.warning(f"Invalid group_by '{group_by}', defaulting to 'day'")
        group_by = "day"

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

    logger.debug(f"Using date range: {period_start} to {period_end}, grouping by {group_by}")

    # Detect database dialect and use appropriate date truncation
    dialect_name = db.bind.dialect.name if hasattr(db.bind, 'dialect') else 'sqlite'
    logger.debug(f"Database dialect: {dialect_name}")

    # Build the date trunc expression based on group_by and database
    if dialect_name == 'postgresql':
        # PostgreSQL uses date_trunc()
        if group_by == "day":
            date_trunc_expr = func.date_trunc("day", Payment.payment_date)
        elif group_by == "week":
            date_trunc_expr = func.date_trunc("week", Payment.payment_date)
        else:  # month
            date_trunc_expr = func.date_trunc("month", Payment.payment_date)
    else:
        # SQLite (and others) - use strftime for compatibility
        if group_by == "day":
            date_trunc_expr = func.strftime("%Y-%m-%d", Payment.payment_date)
        elif group_by == "week":
            # Group by year and week number
            date_trunc_expr = func.strftime("%Y-W%W", Payment.payment_date)
        else:  # month
            date_trunc_expr = func.strftime("%Y-%m", Payment.payment_date)

    # Query for grouped payment data
    # Build base query with ownership filter for managers
    base_payment_query = db.query(Payment).filter(
        and_(
            Payment.payment_date >= period_start,
            Payment.payment_date <= period_end
        )
    )

    # Apply ownership filter for managers
    base_payment_query = apply_ownership_filter(
        base_payment_query.join(Payment.invoice).join(Invoice.purchase_order).join(PurchaseOrder.project),
        Project,
        current_user.id,
        current_user.role
    )

    # Now build the aggregation query from the filtered base
    payment_query = (
        base_payment_query.with_entities(
            date_trunc_expr.label("period"),
            func.sum(Payment.amount).label("paid_amount"),
            func.count(Payment.id).label("paid_count")
        )
        .group_by("period")
        .order_by("period")
    )

    results = payment_query.all()

    logger.debug(f"Found {len(results)} grouped payment periods")

    # Convert results to response format
    data_points = []
    total_amount = 0.0
    total_count = 0

    for row in results:
        # Handle both datetime (PostgreSQL) and string (SQLite) results
        if isinstance(row.period, datetime):
            period_date = row.period
        elif isinstance(row.period, str):
            # Parse string format back to datetime
            if group_by == "day":
                period_date = datetime.strptime(row.period, "%Y-%m-%d")
            elif group_by == "month":
                period_date = datetime.strptime(row.period, "%Y-%m")
            else:  # week
                # Week format: "YYYY-Www"
                year, week = row.period.split("-W")
                period_date = datetime.strptime(f"{year}-W{week}-1", "%Y-W%W-%w")
        else:
            # Fallback
            period_date = period_start

        paid_amount = float(row.paid_amount) if row.paid_amount is not None else 0.0
        paid_count = row.paid_count if row.paid_count is not None else 0

        data_points.append(PaymentDynamicsPoint(
            date=period_date,
            paid_amount=paid_amount,
            paid_count=paid_count
        ))

        total_amount += paid_amount
        total_count += paid_count

    logger.info(
        f"Payment dynamics: group_by={group_by}, periods={len(data_points)}, "
        f"total_amount={total_amount}, total_count={total_count}"
    )

    return PaymentDynamicsResponse(
        data=data_points,
        total_amount=total_amount,
        total_count=total_count,
        period_start=period_start,
        period_end=period_end
    )


@router.get("/export/transactions")
def export_transactions_excel(
    date_from: Optional[datetime] = Query(None, description="Filter transactions from this date (inclusive)"),
    date_to: Optional[datetime] = Query(None, description="Filter transactions until this date (inclusive)"),
    limit: int = Query(1000, ge=1, le=1000, description="Maximum number of rows to export"),
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db)
):
    """
    Export transactions to Excel file for offline analysis.

    Returns a downloadable .xlsx file with columns:
    - date: Transaction/payment date
    - amount: Payment amount
    - invoice_id: Associated invoice ID
    - supplier: Supplier name
    - project: Project name
    - description: Description (from bank transaction or invoice status)

    Filters:
    - date_from: Optional start date for filtering (inclusive)
    - date_to: Optional end date for filtering (inclusive)

    Limits:
    - Maximum 1000 rows per export

    Uses SQLAlchemy joinedload for efficient nested data fetching.
    Converts to pandas DataFrame and exports to Excel using openpyxl.

    Returns:
    - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    - Content-Disposition: attachment; filename=transactions.xlsx

    Logs export date range and row count for observability.
    """
    logger.info(
        "export_transactions_excel called with filters: date_from=%s, date_to=%s, limit=%s",
        date_from, date_to, limit
    )

    # Build query with eager loading for nested relationships
    # Use selectinload for nested relationships (supplier, project)
    query = (
        db.query(Payment)
        .options(
            joinedload(Payment.invoice)
            .joinedload(Invoice.purchase_order)
            .selectinload(PurchaseOrder.supplier),
            joinedload(Payment.invoice)
            .joinedload(Invoice.purchase_order)
            .selectinload(PurchaseOrder.project)
        )
    )

    # Apply date filters if provided
    if date_from:
        query = query.filter(Payment.payment_date >= date_from)
        logger.debug(f"Applied date_from filter: {date_from}")

    if date_to:
        query = query.filter(Payment.payment_date <= date_to)
        logger.debug(f"Applied date_to filter: {date_to}")

    # Order by payment date descending (most recent first)
    query = query.order_by(Payment.payment_date.desc())

    # Apply limit
    query = query.limit(limit)

    # Execute query
    payments = query.all()
    row_count = len(payments)

    logger.info(f"Exporting {row_count} transactions to Excel")

    # Build data for DataFrame
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
            "description": description or ""
        })

    # Create DataFrame and export to Excel
    df = pd.DataFrame(data)

    # Use BytesIO for in-memory file
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Transactions")

    # Reset buffer position to beginning
    output.seek(0)

    # Log export summary
    logger.info(
        f"Excel export complete: rows={row_count}, "
        f"date_range={date_from} to {date_to}, limit={limit}"
    )

    # Return file response with proper headers
    filename = "transactions.xlsx"
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post("/upload-bank-statement", response_model=UploadBankStatementResponse, status_code=status.HTTP_201_CREATED)
async def upload_bank_statement(
    file: UploadFile = File(..., description="Bank statement file in 1C ClientBank .txt format"),
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db)
):
    """
    Upload a bank statement file for manual reconciliation.

    Accepts 1C ClientBank .txt files (CP1251 or UTF-8 encoded).
    Parses the file, creates BankStatement and BankTransaction records,
    and optionally runs auto-matching against invoices.

    Validates:
    - File extension must be .txt (case-insensitive)
    - File size must not exceed 5MB

    Returns:
    - bank_statement_id: ID of created BankStatement record
    - parsed_transactions: Number of transactions parsed
    - matched_count: Number of transactions auto-matched to invoices
    - bank_name: Bank name extracted from statement
    - statement_date: Statement date
    - period_start: Period start date
    - period_end: Period end date

    Logs file name, size, parse result for observability.
    """
    logger.info(
        f"upload_bank_statement called: filename={file.filename}, "
        f"content_type={file.content_type}"
    )

    # Validate file extension (.txt only, case-insensitive)
    if not file.filename or not file.filename.lower().endswith('.txt'):
        logger.warning(f"Invalid file extension: {file.filename}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only .txt files are allowed."
        )

    # Read file content
    content = await file.read()
    file_size = len(content)

    logger.info(f"File read: {file.filename}, size={file_size} bytes")

    # Validate file size (max 5MB)
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    if file_size > MAX_FILE_SIZE:
        logger.warning(f"File size exceeds limit: {file_size} bytes")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size exceeds maximum of 5MB. Got {file_size / 1024 / 1024:.2f}MB."
        )

    # Parse bank statement
    try:
        parser = BankStatementParser()
        parse_result = parser.parse(content)

        parsed_transactions = parse_result.get('transactions', [])
        bank_name = parse_result.get('bank_name', 'Unknown')
        statement_date = parse_result.get('statement_date', datetime.now())
        period_start = parse_result.get('period_start', datetime.now())
        period_end = parse_result.get('period_end', datetime.now())

        logger.info(
            f"Parse successful: bank_name={bank_name}, "
            f"transactions={len(parsed_transactions)}, "
            f"period={period_start} to {period_end}"
        )

    except ValueError as e:
        logger.error(f"Parser error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse bank statement: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected parser error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error while parsing bank statement: {str(e)}"
        )

    # Create BankStatement record
    bank_statement = BankStatement(
        bank_name=bank_name,
        statement_date=statement_date,
        period_start=period_start,
        period_end=period_end,
        raw_file=content,
        status="Готов"
    )
    db.add(bank_statement)
    db.flush()  # Get bank_statement.id

    logger.info(f"Created bank_statement_id={bank_statement.id}")

    # Create BankTransaction records
    transaction_count = 0
    for tx_data in parsed_transactions:
        transaction = BankTransaction(
            bank_statement_id=bank_statement.id,
            transaction_date=tx_data.get('transaction_date', datetime.now()),
            amount=tx_data.get('amount', Decimal('0')),
            supplier_inn=tx_data.get('supplier_inn'),
            description=tx_data.get('description', ''),
            operation_type=tx_data.get('operation_type', 'Debit')
        )
        db.add(transaction)
        transaction_count += 1

    db.commit()

    logger.info(f"Created {transaction_count} BankTransaction records")

    # Run auto-matching
    try:
        matcher = PaymentMatcher(db)
        match_result = matcher.match_statement_transactions(bank_statement.id)
        matched_count = match_result.matched_count

        logger.info(
            f"Auto-matching complete: matched={matched_count}, "
            f"unresolved={match_result.unresolved_count}"
        )

    except Exception as e:
        logger.error(f"Auto-matching error: {str(e)}", exc_info=True)
        # Continue without failing - transactions are stored
        matched_count = 0

    return UploadBankStatementResponse(
        bank_statement_id=bank_statement.id,
        parsed_transactions=transaction_count,
        matched_count=matched_count,
        bank_name=bank_name,
        statement_date=statement_date,
        period_start=period_start,
        period_end=period_end
    )
