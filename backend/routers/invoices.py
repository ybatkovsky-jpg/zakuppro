"""
Invoice CRUD router for ZakupPro API.
Provides endpoints for managing supplier invoices.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Invoice
from backend.schemas import InvoiceCreate, InvoiceUpdate, InvoiceResponse

router = APIRouter(prefix="/api/invoices", tags=["invoices"])


@router.get("/", response_model=List[InvoiceResponse])
def list_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    List all invoices with pagination.
    """
    invoices = db.query(Invoice).offset(skip).limit(limit).all()
    return invoices


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """
    Get a single invoice by ID with eager-loaded payments.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with id {invoice_id} not found"
        )
    return invoice


@router.post("/", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(invoice_data: InvoiceCreate, db: Session = Depends(get_db)):
    """
    Create a new invoice.
    """
    new_invoice = Invoice(**invoice_data.model_dump())
    db.add(new_invoice)
    db.commit()
    db.refresh(new_invoice)
    return new_invoice


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(invoice_id: int, invoice_data: InvoiceUpdate, db: Session = Depends(get_db)):
    """
    Update an existing invoice.
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with id {invoice_id} not found"
        )

    update_data = invoice_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(invoice, field, value)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """
    Delete an invoice (cascade deletes payments).
    """
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice with id {invoice_id} not found"
        )

    db.delete(invoice)
    db.commit()
