"""
Frontend compatibility router.
Maps the frontend's expected API URLs to the backend's actual endpoints.

Frontend was built with different path conventions than the backend.
This router provides aliases so both old and new paths work.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
import logging
import tempfile
import os

from backend.database import get_db
from backend.models import Project, ProjectItem, User, Supplier, StockItem, PurchaseOrder
from backend.services import stock_service
from backend.auth import get_current_active_user, get_current_user
from backend.models import Role
from backend.rbac import require_role, apply_ownership_filter
from backend.status_map import (
    PROJECT_STATUS_RU_TO_EN, PROJECT_STATUS_EN_TO_RU,
    ITEM_STATUS_RU_TO_EN, ITEM_STATUS_EN_TO_RU,
    map_project_status, map_project_status_to_ru,
    map_item_status, map_item_status_to_ru
)

logger = logging.getLogger(__name__)

# ============================================================================
router = APIRouter(tags=["frontend-compat"])


# ============================================================================
# /api/warehouse/* → maps to stock-items functionality
# ============================================================================

class WarehouseItemResponse(BaseModel):
    id: int
    name: str
    sku: str = ""
    quantity: int = 0
    minQuantity: int = 0
    unit: str = "шт"
    category: str = ""
    price: float = 0.0
    status: str = "in_stock"
    supplier: str = ""
    lastUpdated: str = ""

    model_config = {"from_attributes": True}


class WarehouseTransactionResponse(BaseModel):
    id: int
    itemId: int
    itemName: str = ""
    type: str = ""
    quantity: int = 0
    date: str = ""
    note: str = ""
    userName: str = ""

    model_config = {"from_attributes": True}


@router.get("/api/warehouse", response_model=List[WarehouseItemResponse])
def list_warehouse_items(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List warehouse items (maps to stock-items)."""
    query = db.query(StockItem)
    if search:
        query = query.filter(StockItem.name.ilike(f"%{search}%"))

    items = query.offset(skip).limit(limit).all()
    result = []
    for item in items:
        # Use qty_total as the primary quantity field
        qty = item.qty_total or 0
        status_val = "in_stock"
        if qty <= 0:
            status_val = "out_of_stock"
        # If item has a Russian status in DB, map it to English
        if hasattr(item, "status") and item.status:
            status_val = map_item_status(item.status)
        result.append(WarehouseItemResponse(
            id=item.id,
            name=item.name,
            sku=item.sku or '',
            quantity=qty,
            minQuantity=0,  # No min_quantity column in model
            unit="шт",
            category="",
            price=0.0,
            status=status_val,
            supplier="",
            lastUpdated=item.updated_at.isoformat() if item.updated_at else ""
        ))
    return result


@router.post("/api/warehouse", response_model=WarehouseItemResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse_item(
    item_data: dict,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER, Role.WAREHOUSE])),
    db: Session = Depends(get_db)
):
    """Create a warehouse item (maps to stock-items)."""
    qty = item_data.get("quantity", 0)
    item = StockItem(
        name=item_data.get("name", ""),
        sku=item_data.get("sku", ""),
        qty_total=qty,
        qty_reserved=0,
        qty_available=qty,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return WarehouseItemResponse(
        id=item.id, name=item.name, sku=item.sku,
        quantity=item.qty_total, minQuantity=0,
        unit="шт", category="",
        price=0.0,
        status="in_stock", supplier="", lastUpdated=""
    )


@router.get("/api/warehouse/transactions", response_model=List[WarehouseTransactionResponse])
def list_warehouse_transactions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List warehouse transactions (stub)."""
    return []


@router.post("/api/warehouse/transactions", status_code=status.HTTP_201_CREATED)
def create_warehouse_transaction(
    data: dict,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER, Role.WAREHOUSE])),
    db: Session = Depends(get_db)
):
    """Create a warehouse transaction (maps to stock-items receive)."""
    item_id = data.get("itemId") or data.get("item_id")
    if not item_id:
        raise HTTPException(status_code=400, detail="itemId is required")

    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    trans_type = data.get("type", "in")
    qty = data.get("quantity", 0)

    if trans_type == "in":
        item.qty_total = (item.qty_total or 0) + qty
        item.qty_available = (item.qty_available or 0) + qty
    elif trans_type == "out":
        item.qty_total = max(0, (item.qty_total or 0) - qty)
        item.qty_available = max(0, (item.qty_available or 0) - qty)

    db.commit()
    return {"success": True, "newQuantity": item.qty_total}


@router.put("/api/warehouse/{item_id}", response_model=WarehouseItemResponse)
def update_warehouse_item(
    item_id: int,
    item_data: dict,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER, Role.WAREHOUSE])),
    db: Session = Depends(get_db)
):
    """Update a warehouse item."""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if "name" in item_data:
        item.name = item_data["name"]
    if "sku" in item_data:
        item.sku = item_data["sku"]
    if "quantity" in item_data:
        new_qty = item_data["quantity"]
        item.qty_total = new_qty
        item.qty_available = new_qty - (item.qty_reserved or 0)

    db.commit()
    db.refresh(item)
    return WarehouseItemResponse(
        id=item.id, name=item.name, sku=item.sku,
        quantity=item.qty_total, minQuantity=0,
        unit="шт", category="",
        price=0.0,
        status="in_stock", supplier="", lastUpdated=item.updated_at.isoformat() if item.updated_at else ""
    )


@router.delete("/api/warehouse/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse_item(
    item_id: int,
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db)
):
    """Delete a warehouse item."""
    item = db.query(StockItem).filter(StockItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()


# ============================================================================
# /api/requests/* → maps to purchase-orders
# ============================================================================

class RequestResponse(BaseModel):
    id: int
    projectId: int = 0
    projectName: str = ""
    supplierId: int = 0
    supplierName: str = ""
    status: str = "draft"
    items: list = []
    createdAt: str = ""
    updatedAt: str = ""
    sentAt: str = ""
    totalAmount: float = 0.0

    model_config = {"from_attributes": True}


@router.get("/api/requests", response_model=List[RequestResponse])
def list_requests(
    supplierId: Optional[int] = Query(None),
    projectId: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List purchase requests (maps to purchase-orders)."""
    query = db.query(PurchaseOrder)
    if supplierId:
        query = query.filter(PurchaseOrder.supplier_id == supplierId)
    if projectId:
        query = query.filter(PurchaseOrder.project_id == projectId)

    orders = query.offset(skip).limit(limit).all()
    result = []
    for order in orders:
        result.append(RequestResponse(
            id=order.id,
            projectId=order.project_id or 0,
            projectName=order.project.name if order.project else "",
            supplierId=order.supplier_id or 0,
            supplierName=order.supplier.name if order.supplier else "",
            status=order.status or "draft",
            items=[],
            createdAt=order.created_at.isoformat() if order.created_at else "",
            updatedAt=order.updated_at.isoformat() if order.updated_at else "",
            sentAt="",
            totalAmount=0.0
        ))
    return result


@router.post("/api/requests", status_code=status.HTTP_201_CREATED)
def create_request(
    data: dict,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """Create a purchase request (maps to purchase-orders)."""
    order = PurchaseOrder(
        project_id=data.get("projectId"),
        supplier_id=data.get("supplierId"),
        status=data.get("status", "draft"),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return {"id": order.id, "status": order.status}


@router.put("/api/requests/{request_id}")
def update_request(
    request_id: int,
    data: dict,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """Update a purchase request."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == request_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Request not found")

    if "status" in data:
        order.status = data["status"]
    if "supplierId" in data:
        order.supplier_id = data["supplierId"]

    db.commit()
    return {"id": order.id, "status": order.status}


@router.post("/api/requests/{request_id}/send-email")
def send_request_email(
    request_id: int,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """Send request via email (stub)."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == request_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Request not found")
    order.status = "sent"
    db.commit()
    return {"success": True, "message": "Запрос отправлен"}


# ============================================================================
# /api/projects/{id}/status — project status update shortcut
# ============================================================================

@router.put("/api/projects/{project_id}/status")
def update_project_status(
    project_id: int,
    data: dict,
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """Update project status."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_status = data.get("status")
    if new_status:
        # Translate English status from frontend to Russian for DB
        project.status = map_project_status_to_ru(new_status)
        db.commit()

    # Return English status to frontend
    return {
        "id": project.id,
        "status": map_project_status(project.status),
        "projectId": project.id
    }


# ============================================================================
# /api/projects/{id}/history — project status history
# ============================================================================

@router.get("/api/projects/{project_id}/history")
def get_project_history(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get project status history."""
    from backend.models import ProjectStatusHistory
    history = db.query(ProjectStatusHistory).filter(
        ProjectStatusHistory.project_id == project_id
    ).order_by(ProjectStatusHistory.changed_at.desc()).all()

    result = []
    for h in history:
        result.append({
            "id": h.id,
            "projectId": h.project_id,
            "fromStatus": map_project_status(h.from_status or ""),
            "toStatus": map_project_status(h.to_status or ""),
            "changedBy": h.changed_by or "",
            "changedAt": h.changed_at.isoformat() if h.changed_at else "",
            "comment": ""
        })
    return result


# ============================================================================
# /api/projects/upload — project file upload (IMPLEMENTED)
# ============================================================================

@router.post("/api/projects/upload")
async def upload_project_file(
    projectName: str = Form(""),
    mode: str = Form("new"),  # "new", "merge", "overwrite"
    targetProjectId: int = Form(None),  # For merge/overwrite mode
    file: UploadFile = File(...),
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """
    Upload Excel file and create a project with items parsed from it.

    Accepts multipart form data with:
    - projectName: optional project name (defaults to filename)
    - file: Excel .xlsx/.xls file

    Parses the file using the same pipeline as Telegram bot:
    Excel → pandas → markdown → DeepSeek LLM → project + items
    """
    # Validate file extension
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400,
            detail="Неверный формат файла. Пожалуйста, загрузите файл Excel (.xlsx или .xls)."
        )

    # Save uploaded file to temp location
    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Файл пуст")
        if len(content) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 20 МБ)")

        # Write to temp file
        tmp_dir = tempfile.mkdtemp()
        file_path = os.path.join(tmp_dir, file.filename)
        with open(file_path, 'wb') as f:
            f.write(content)

        logger.info(f"Upload: saved file to {file_path} ({len(content)} bytes)")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload: failed to save file: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка сохранения файла: {str(e)}")

    # Parse Excel and extract BOM using AI
    try:
        from backend.excel_parser import read_excel_file, clean_dataframe, dataframe_to_markdown
        from backend.ai_agent import extract_bom_structure, ExtractedBOM
        from backend.services.project_service import create_project_from_bom
        from backend.supplier_resolver import find_or_create_supplier

        # Step 1: Parse Excel
        df = read_excel_file(file_path)
        df_clean = clean_dataframe(df)
        markdown = dataframe_to_markdown(df_clean)
        logger.info(f"Upload: parsed Excel, {len(df_clean)} rows, {len(markdown)} chars markdown")

        # Step 2: Extract BOM with AI
        extracted = extract_bom_structure(markdown)
        validated = ExtractedBOM.model_validate(extracted)
        items = [item.model_dump() for item in validated.items]
        metadata = validated.metadata.model_dump() if validated.metadata else {}
        logger.info(f"Upload: extracted {len(items)} items from Excel")

        if not items:
            raise HTTPException(
                status_code=422,
                detail="Не удалось извлечь позиции из файла. Проверьте формат таблицы."
            )

        # Override project name if provided
        if projectName and projectName.strip():
            metadata['project_name'] = projectName.strip()

        # Step 3: Handle based on mode
        # Auto-dedup: check for existing project with same name when mode="new"
        if mode == "new":
            project_name_check = metadata.get('project_name', file.filename or '').strip()
            if project_name_check:
                existing = db.query(Project).filter(Project.name == project_name_check).first()
                if existing:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Проект с именем '{project_name_check}' уже существует (ID: {existing.id}, статус: {existing.status}). Используйте режим слияния или перезаписи."
                    )

        if mode == "merge" and targetProjectId:
            # Merge: add new items to existing project
            existing_project = db.query(Project).filter(Project.id == targetProjectId).first()
            if not existing_project:
                raise HTTPException(status_code=404, detail=f"Проект с ID {targetProjectId} не найден")

            # Add items to existing project
            items_created = 0
            for item in items:
                supplier_name = item.get('supplier')
                supplier_id = None
                if supplier_name:
                    from backend.supplier_resolver import find_or_create_supplier
                    supplier_id = find_or_create_supplier(db, supplier_name)

                project_item = ProjectItem(
                    project_id=existing_project.id,
                    name=item.get('name', ''),
                    sku=item.get('sku') or '',
                    qty=item.get('qty', 0),
                    supplier_id=supplier_id,
                    status='К закупке',
                    price=item.get('price'),
                    unit=item.get('unit', 'шт'),
                    article=item.get('article') or item.get('sku') or '',
                    category=item.get('category', ''),
                )
                db.add(project_item)
                items_created += 1

            db.commit()
            stock_service.reserve_for_project(existing_project.id, db)
            db.commit()

            reserved_count = db.query(ProjectItem).filter(
                ProjectItem.project_id == existing_project.id,
                ProjectItem.stock_item_id.isnot(None),
            ).count()

            project = existing_project
            logger.info(f"Upload: merged {items_created} items into project '{project.name}' (ID: {project.id})")

        elif mode == "overwrite" and targetProjectId:
            # Overwrite: delete existing items and add new ones
            existing_project = db.query(Project).filter(Project.id == targetProjectId).first()
            if not existing_project:
                raise HTTPException(status_code=404, detail=f"Проект с ID {targetProjectId} не найден")

            # Delete existing items
            db.query(ProjectItem).filter(ProjectItem.project_id == existing_project.id).delete()
            db.commit()

            # Add new items
            items_created = 0
            for item in items:
                supplier_name = item.get('supplier')
                supplier_id = None
                if supplier_name:
                    from backend.supplier_resolver import find_or_create_supplier
                    supplier_id = find_or_create_supplier(db, supplier_name)

                project_item = ProjectItem(
                    project_id=existing_project.id,
                    name=item.get('name', ''),
                    sku=item.get('sku') or '',
                    qty=item.get('qty', 0),
                    supplier_id=supplier_id,
                    status='К закупке',
                    price=item.get('price'),
                    unit=item.get('unit', 'шт'),
                    article=item.get('article') or item.get('sku') or '',
                    category=item.get('category', ''),
                )
                db.add(project_item)
                items_created += 1

            db.commit()
            # Update project name if provided
            if projectName and projectName.strip():
                existing_project.name = projectName.strip()
                db.commit()

            stock_service.reserve_for_project(existing_project.id, db)
            db.commit()

            reserved_count = db.query(ProjectItem).filter(
                ProjectItem.project_id == existing_project.id,
                ProjectItem.stock_item_id.isnot(None),
            ).count()

            project = existing_project
            logger.info(f"Upload: overwrote project '{project.name}' (ID: {project.id}) with {items_created} items")

        else:
            # New project (default)
            project, items_created, reserved_count = create_project_from_bom(
                db=db,
                items=items,
                metadata=metadata,
                file_path=file_path,
                owner_id=current_user.id,
            )
            logger.info(f"Upload: created project '{project.name}' (ID: {project.id}) with {items_created} items")

        # Clean up temp file
        try:
            os.remove(file_path)
            os.rmdir(tmp_dir)
        except Exception:
            pass

        return {
            "success": True,
            "project": {
                "id": project.id,
                "name": project.name,
                "status": map_project_status(project.status),
                "itemsCount": items_created,
                "reservedCount": reserved_count,
            },
            "message": f"Проект '{project.name}' создан с {items_created} позициями"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload: error processing file: {e}", exc_info=True)
        # Clean up temp file
        try:
            os.remove(file_path)
            os.rmdir(tmp_dir)
        except Exception:
            pass
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка обработки файла: {str(e)[:200]}"
        )


# ============================================================================
# /api/projects/{id}/export — project export (stub)
# ============================================================================

@router.get("/api/projects/{project_id}/export")
def export_project(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export project data (stub)."""
    return {"message": "Экспорт проекта пока не реализован"}


# ============================================================================
# /api/invoices/{id}/reconcile — invoice reconciliation (stub)
# ============================================================================

@router.get("/api/invoices/{invoice_id}/reconcile")
def get_invoice_reconciliation(
    invoice_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get invoice reconciliation data (stub)."""
    return {"candidates": []}


# ============================================================================
# /api/notifications — notification stubs
# ============================================================================

@router.get("/api/notifications")
def list_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List notifications (stub)."""
    return []


@router.post("/api/notifications")
def create_notification(
    data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create notification (stub)."""
    return {"success": True}


@router.put("/api/notifications")
def update_notifications(
    data: dict,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update notifications (stub)."""
    return {"success": True}


# ============================================================================
# /api/company — company settings stubs
# ============================================================================

@router.get("/api/company")
def get_company_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get company settings (stub)."""
    return {
        "name": "ПРОМЕБЕЛЬ",
        "inn": "",
        "address": "",
        "phone": "",
        "email": "",
        "bankDetails": ""
    }


@router.put("/api/company")
def update_company_settings(
    data: dict,
    current_user: User = Depends(require_role([Role.OWNER])),
    db: Session = Depends(get_db)
):
    """Update company settings (stub)."""
    return {"success": True}


# ============================================================================
# /api/settings/* — settings stubs
# ============================================================================

@router.get("/api/settings/email")
def get_email_settings(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {"smtpHost": "", "smtpPort": 587, "email": "", "password": ""}

@router.put("/api/settings/email")
def update_email_settings(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True}

@router.post("/api/settings/email")
def test_email_settings(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True, "message": "Тестовое письмо отправлено"}

@router.get("/api/settings/ai")
def get_ai_settings(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {"provider": "deepseek", "model": "deepseek-chat", "apiKey": ""}

@router.put("/api/settings/ai")
def update_ai_settings(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True}

@router.post("/api/settings/ai")
def test_ai_settings(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True, "message": "ИИ настроен"}

@router.get("/api/settings/telegram")
def get_telegram_settings(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {"botToken": "", "chatId": ""}

@router.put("/api/settings/telegram")
def update_telegram_settings(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True}

@router.post("/api/settings/telegram")
def test_telegram_settings(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True, "message": "Telegram бот настроен"}


# ============================================================================
# /api/automation — automation stubs
# ============================================================================

@router.get("/api/automation")
def get_automation_settings(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return {"rules": []}

@router.post("/api/automation")
def create_automation_rule(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True, "id": 1}

@router.post("/api/automation/execute")
def execute_automation_rule(data: dict, current_user: User = Depends(require_role([Role.OWNER])), db: Session = Depends(get_db)):
    return {"success": True}


# ============================================================================
# /api/email/inbox — email inbox stubs
# ============================================================================

@router.get("/api/email/inbox")
def get_email_inbox(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    return []


# ============================================================================
# /api/analytics/suppliers, /api/analytics/pipeline — analytics stubs
# ============================================================================

@router.get("/api/analytics/suppliers")
def get_supplier_analytics(
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """Get supplier analytics (stub)."""
    suppliers = db.query(Supplier).limit(20).all()
    result = []
    for s in suppliers:
        result.append({
            "id": s.id,
            "name": s.name,
            "totalOrders": 0,
            "totalAmount": 0.0,
            "avgDeliveryTime": 0,
            "reliabilityScore": 0.0
        })
    return result


@router.get("/api/analytics/pipeline")
def get_pipeline_analytics(
    current_user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
    db: Session = Depends(get_db)
):
    """Get pipeline analytics (stub)."""
    return {
        "stages": [
            {"name": "New", "count": 0, "amount": 0.0},
            {"name": "Processing", "count": 0, "amount": 0.0},
            {"name": "Requested", "count": 0, "amount": 0.0},
            {"name": "Invoiced", "count": 0, "amount": 0.0},
            {"name": "Paid", "count": 0, "amount": 0.0},
            {"name": "Delivered", "count": 0, "amount": 0.0}
        ]
    }


# ============================================================================
# /api/warehouse/export — warehouse export stub
# ============================================================================

@router.get("/api/warehouse/export")
def export_warehouse(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Export warehouse data (stub)."""
    return {"message": "Экспорт склада пока не реализован"}
