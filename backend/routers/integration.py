"""
Integration API router for FinPro sync.

All endpoints require X-API-Key header for authentication.
Version: /api/v1/integration
"""
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from backend.database import get_db
from backend.models import Project, ProjectItem, PurchaseOrder, Invoice, InvoiceItem, Payment, ProductionTask, Supplier
from backend.schemas import (
    ProjectSyncItem,
    ProjectSyncResponse,
    IntegrationProjectItem,
    ProcurementLine,
    ProcurementResponse,
    ProductionLine,
    ProductionResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/integration", tags=["integration"])


# =============================================================================
# API Key Authentication Dependency
# =============================================================================

def verify_api_key(x_api_key: str = Header(..., alias="X-API-Key")) -> str:
    """
    Verify the X-API-Key header against the server's configured key.
    
    Returns the key if valid, raises 401/403 if not.
    """
    expected_key = os.getenv("ZAKUPPRO_API_KEY", "")
    if not expected_key:
        logger.error("ZAKUPPRO_API_KEY env var is not set on the server")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Integration API is not configured on the server"
        )
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-API-Key header is required"
        )
    if x_api_key != expected_key:
        logger.warning("Invalid API key attempt from integration endpoint")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key"
        )
    return x_api_key


# =============================================================================
# Endpoints
# =============================================================================

@router.get("/projects", response_model=ProjectSyncResponse)
def list_projects_for_sync(
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    api_key: str = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    """
    Full project directory export for FinPro synchronization.
    
    Returns ALL projects including completed and cancelled ones,
    with pagination support.
    
    Requires X-API-Key header.
    """
    total = db.query(Project).count()
    offset = (page - 1) * limit
    
    projects = db.query(Project).order_by(Project.id).offset(offset).limit(limit).all()
    
    items = []
    for project in projects:
        project_items = []
        for item in project.items:
            project_items.append(IntegrationProjectItem(
                id=item.id,
                name=item.name,
                sku=item.sku,
                qty=item.qty,
                status=item.status,
                supplier_id=item.supplier_id,
                unit_price=None,  # Not tracked at BOM level
                total_price=None,
                created_at=item.created_at,
                updated_at=item.updated_at,
            ))
        
        items.append(ProjectSyncItem(
            id=project.id,
            contract_number=project.contract_number,
            name=project.name,
            client=project.client,
            status=project.status,
            total_cost=float(project.total_cost) if project.total_cost else None,
            owner_id=project.owner_id,
            created_at=project.created_at,
            updated_at=project.updated_at,
            items=project_items,
        ))
    
    logger.info(f"Integration: exported {len(items)} projects (page {page}, limit {limit})")
    
    return ProjectSyncResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/projects/{contract_number}/procurement", response_model=ProcurementResponse)
def get_procurement_data(
    contract_number: str,
    api_key: str = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    """
    Detailed procurement lines for a specific project.
    
    Includes all purchase orders, invoices, and payment data
    mapped to the project by contract_number.
    Includes cancelled and zero-amount items (FinPro filters as needed).
    
    Requires X-API-Key header.
    """
    project = db.query(Project).filter(Project.contract_number == contract_number).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with contract_number '{contract_number}' not found"
        )
    
    lines = []
    
    # Get all purchase orders for this project
    purchase_orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.project_id == project.id
    ).all()
    
    for po in purchase_orders:
        supplier_name = po.supplier.name if po.supplier else "Неизвестный поставщик"
        
        for invoice in po.invoices:
            # Get invoice items for category mapping
            invoice_items = db.query(InvoiceItem).filter(
                InvoiceItem.invoice_id == invoice.id
            ).all()
            
            # Get payments for this invoice
            payments = db.query(Payment).filter(
                Payment.invoice_id == invoice.id
            ).all()
            
            if invoice_items:
                # Map each invoice item as a procurement line
                for ii in invoice_items:
                    # Determine category from item name/SKU
                    category = _categorize_item(ii.name, ii.sku)
                    
                    # Map invoice status to integration status
                    line_status = _map_invoice_status(invoice.status)
                    
                    lines.append(ProcurementLine(
                        id=ii.id,
                        project_contract_number=contract_number,
                        date=invoice.created_at,
                        amount=float(ii.total_price) if ii.total_price else 0.0,
                        category=category,
                        counterparty_name=supplier_name,
                        document_ref=f"Счёт #{invoice.id}" if invoice.id else None,
                        status=line_status,
                    ))
            else:
                # Invoice with no line items - create single line from total
                total_amount = sum(float(p.amount) for p in payments) if payments else 0.0
                line_status = _map_invoice_status(invoice.status)
                
                lines.append(ProcurementLine(
                    id=invoice.id * 10000,  # Unique ID for header-level lines
                    project_contract_number=contract_number,
                    date=invoice.created_at,
                    amount=total_amount,
                    category="Прочее",
                    counterparty_name=supplier_name,
                    document_ref=f"Счёт #{invoice.id}" if invoice.id else None,
                    status=line_status,
                ))
    
    total_amount = sum(line.amount for line in lines)
    
    logger.info(f"Integration: exported {len(lines)} procurement lines for project {contract_number}")
    
    return ProcurementResponse(
        project_contract_number=contract_number,
        lines=lines,
        total_amount=total_amount,
    )


@router.get("/projects/{contract_number}/production", response_model=ProductionResponse)
def get_production_data(
    contract_number: str,
    api_key: str = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    """
    Detailed production task lines for a specific project.
    
    Includes all production tasks with their status and costs.
    
    Requires X-API-Key header.
    """
    project = db.query(Project).filter(Project.contract_number == contract_number).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with contract_number '{contract_number}' not found"
        )
    
    lines = []
    
    production_tasks = db.query(ProductionTask).filter(
        ProductionTask.project_id == project.id
    ).all()
    
    for task in production_tasks:
        # Map task status to integration status
        mapped_status = _map_production_status(task.status)
        
        # Estimate cost from project total_cost if available
        # Production tasks don't have individual costs in current schema
        estimated_amount = 0.0
        if project.total_cost and len(production_tasks) > 0:
            estimated_amount = float(project.total_cost) / len(production_tasks)
        
        description = task.status
        if task.custom_reason:
            description = f"{task.status} — {task.custom_reason}"
        if task.delay_reason:
            description = f"{task.status} — задержка: {task.delay_reason.value}"
        
        lines.append(ProductionLine(
            id=task.id,
            project_contract_number=contract_number,
            date=task.created_at,
            amount=estimated_amount,
            description=description,
            status=mapped_status,
        ))
    
    total_amount = sum(line.amount for line in lines)
    
    logger.info(f"Integration: exported {len(lines)} production lines for project {contract_number}")
    
    return ProductionResponse(
        project_contract_number=contract_number,
        lines=lines,
        total_amount=total_amount,
    )


# =============================================================================
# Helper functions
# =============================================================================

def _categorize_item(name: str, sku: str) -> str:
    """Categorize a procurement item based on name and SKU."""
    name_lower = (name or "").lower()
    sku_lower = (sku or "").lower()
    
    delivery_keywords = ["доставк", "транспорт", "перевозк", "логист", "shipping", "delivery"]
    component_keywords = ["комплект", "фурнитур", "петл", "ручк", "направля", "крепёж", "крепеж", "винт", "болт", "саморез", "hinge", "handle"]
    
    for kw in delivery_keywords:
        if kw in name_lower or kw in sku_lower:
            return "Доставка"
    
    for kw in component_keywords:
        if kw in name_lower or kw in sku_lower:
            return "Комплектующие"
    
    return "Материалы"


def _map_invoice_status(status: str) -> str:
    """Map ZakupPro invoice status to integration status."""
    mapping = {
        "Ожидает сверки": "approved",
        "Ошибки": "cancelled",
        "Сверен": "approved",
        "Ожидает оплаты": "approved",
        "Оплачен": "paid",
    }
    return mapping.get(status, "approved")


def _map_production_status(status: str) -> str:
    """Map ZakupPro production status to integration status."""
    mapping = {
        "Ожидание комплектации": "in_progress",
        "В работе": "in_progress",
        "Готов к отгрузке": "completed",
        "У заказчика": "accepted",
    }
    return mapping.get(status, "in_progress")
