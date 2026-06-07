"""
Stats router for ZakupPro API.
Provides aggregated statistics for the frontend dashboard and sidebar.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import logging

from backend.database import get_db
from backend.models import (
    User, Project, Supplier, StockItem, PurchaseOrder,
    Invoice, InvoiceItem, ProjectItem
)
from backend.auth import get_current_active_user
from backend.models import Role
from backend.rbac import require_role, apply_ownership_filter

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["stats"])


class StatsResponse(BaseModel):
    totalProjects: int = 0
    activeProjects: int = 0
    completedProjects: int = 0
    totalSuppliers: int = 0
    totalWarehouseItems: int = 0
    lowStockItems: int = 0
    pendingRequests: int = 0
    sentRequests: int = 0
    unpaidInvoices: int = 0
    totalInvoiceAmount: float = 0.0
    recentProjects: list = []
    budgetData: dict = {"totalBudget": 0, "spentBudget": 0, "pendingBudget": 0, "byCategory": []}
    projectCostData: list = []
    projectStatusData: list = []
    monthlyProjectsData: list = []
    warehouseStockData: list = []
    urgentItems: list = []


class ActivityItem(BaseModel):
    id: str
    type: str
    title: str
    description: str
    timestamp: str


class DeliveryItem(BaseModel):
    id: int
    projectName: str = ""
    supplierName: str = ""
    deliveryDate: str = ""
    status: str = ""
    amount: float = 0.0


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get aggregated statistics for dashboard and sidebar."""
    try:
        # Project counts
        project_query = db.query(Project)
        project_query = apply_ownership_filter(project_query, Project, current_user.id, current_user.role)
        
        total_projects = project_query.count()
        active_projects = project_query.filter(Project.status.in_(["Проектирование", "Закупки", "К закупке"])).count()
        completed_projects = project_query.filter(Project.status == "Завершён").count()
        
        # Supplier count
        total_suppliers = db.query(Supplier).count()
        
        # Warehouse items
        total_warehouse = db.query(StockItem).count()
        low_stock = db.query(StockItem).filter(StockItem.qty_available <= 0).count()
        
        # Purchase orders (requests)
        po_query = db.query(PurchaseOrder)
        pending_requests = po_query.filter(PurchaseOrder.status == "draft").count()
        sent_requests = po_query.filter(PurchaseOrder.status == "sent").count()
        
        # Invoices
        unpaid_statuses = ["Ожидает сверки", "Ошибки", "Ожидает оплаты"]
        unpaid_invoices = db.query(Invoice).filter(Invoice.status.in_(unpaid_statuses)).count()
        
        total_invoice_amount = float(
            db.query(func.sum(InvoiceItem.total_price)).scalar() or 0
        )
        
        # Recent projects
        recent = project_query.order_by(Project.created_at.desc()).limit(5).all()
        recent_projects = []
        for p in recent:
            recent_projects.append({
                "id": str(p.id),
                "name": p.name,
                "description": getattr(p, "description", "") or "",
                "status": p.status,
                "fileName": "",
                "customerName": p.client or "",
                "createdAt": p.created_at.isoformat() if p.created_at else "",
                "updatedAt": p.updated_at.isoformat() if p.updated_at else "",
                "_count": {"items": len(p.items) if hasattr(p, 'items') and p.items else 0}
            })
        
        # Project status distribution
        status_counts = {}
        for p in project_query.all():
            s = p.status or "unknown"
            status_counts[s] = status_counts.get(s, 0) + 1
        
        status_colors = {
            "new": "#3b82f6", "processing": "#f59e0b", "requested": "#8b5cf6",
            "invoiced": "#06b6d4", "paid": "#10b981", "delivered": "#22c55e",
            "completed": "#10b981", "cancelled": "#ef4444",
            "Проектирование": "#3b82f6", "Закупки": "#f59e0b", "К закупке": "#8b5cf6",
            "В производстве": "#06b6d4", "Монтаж": "#22c55e", "Завершён": "#10b981",
        }
        project_status_data = [
            {"name": k, "value": v, "color": status_colors.get(k, "#6b7280")}
            for k, v in status_counts.items()
        ]
        
        # Monthly projects data (last 6 months)
        monthly_data = []
        from datetime import timedelta
        for i in range(5, -1, -1):
            month_date = datetime.utcnow() - timedelta(days=30 * i)
            month_str = month_date.strftime("%Y-%m")
            count = project_query.filter(
                func.to_char(Project.created_at, 'YYYY-MM') == month_str
            ).count()
            monthly_data.append({"month": month_str, "count": count})
        
        # Warehouse stock data
        stock_items = db.query(StockItem).limit(20).all()
        warehouse_stock_data = []
        for item in stock_items:
            status_val = "ok"
            if item.qty_available <= 0:
                status_val = "low" if item.qty_total == 0 else "warning"
            warehouse_stock_data.append({
                "name": item.name,
                "quantity": item.qty_total,
                "minQuantity": 0,
                "status": status_val
            })
        
        # Urgent items
        urgent_items = []
        if low_stock > 0:
            low_items = db.query(StockItem).filter(StockItem.qty_available <= 0).limit(5).all()
            for item in low_items:
                urgent_items.append({
                    "type": "restock",
                    "label": f"Низкий запас: {item.name}",
                    "targetId": str(item.id),
                    "urgency": "urgent" if item.qty_total == 0 else "pending"
                })
        
        return StatsResponse(
            totalProjects=total_projects,
            activeProjects=active_projects,
            completedProjects=completed_projects,
            totalSuppliers=total_suppliers,
            totalWarehouseItems=total_warehouse,
            lowStockItems=low_stock,
            pendingRequests=pending_requests,
            sentRequests=sent_requests,
            unpaidInvoices=unpaid_invoices,
            totalInvoiceAmount=total_invoice_amount,
            recentProjects=recent_projects,
            budgetData={"totalBudget": 0, "spentBudget": 0, "pendingBudget": 0, "byCategory": []},
            projectCostData=[],
            projectStatusData=project_status_data,
            monthlyProjectsData=monthly_data,
            warehouseStockData=warehouse_stock_data,
            urgentItems=urgent_items
        )
    except Exception as e:
        logger.error(f"Stats endpoint error: {e}", exc_info=True)
        return StatsResponse()


@router.get("/activity", response_model=List[ActivityItem])
def get_activity(
    limit: int = 20,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get recent activity items for the dashboard."""
    activities = []
    
    try:
        # Recent projects as activity
        project_query = db.query(Project)
        project_query = apply_ownership_filter(project_query, Project, current_user.id, current_user.role)
        recent_projects = project_query.order_by(Project.created_at.desc()).limit(10).all()
        
        for p in recent_projects:
            activities.append(ActivityItem(
                id=f"project-{p.id}",
                type="project_created",
                title=f"Проект: {p.name}",
                description=f"Создан проект '{p.name}' со статусом '{p.status}'",
                timestamp=p.created_at.isoformat() if p.created_at else datetime.utcnow().isoformat()
            ))
        
        # Recent invoices
        recent_invoices = db.query(Invoice).order_by(Invoice.created_at.desc()).limit(5).all()
        for inv in recent_invoices:
            activities.append(ActivityItem(
                id=f"invoice-{inv.id}",
                type="invoice_received",
                title=f"Счёт #{inv.id}",
                description=f"Получен счёт со статусом '{inv.status}'",
                timestamp=inv.created_at.isoformat() if inv.created_at else datetime.utcnow().isoformat()
            ))
        
        # Sort by timestamp descending
        activities.sort(key=lambda x: x.timestamp, reverse=True)
    except Exception as e:
        logger.error(f"Activity endpoint error: {e}", exc_info=True)
    
    return activities[:limit]


@router.get("/deliveries", response_model=List[DeliveryItem])
def get_deliveries(
    projectId: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get deliveries list for the dashboard."""
    deliveries = []
    # Stub: no delivery model yet, return empty list
    return deliveries

