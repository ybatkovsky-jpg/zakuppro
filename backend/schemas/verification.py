"""
Pydantic v2 schemas for invoice verification results.
Stored in Invoice.verification_result JSONB column.
Uses from_attributes=True for ORM mode compatibility with SQLAlchemy.
"""
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


# =============================================================================
# Base Configuration
# =============================================================================

class BaseSchema(BaseModel):
    """Base schema with ORM mode enabled for Pydantic v2."""
    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Item Verification Schema
# =============================================================================

class ItemVerification(BaseSchema):
    """
    Verification result for a single invoice item matched to a project BOM item.
    Tracks how invoice items map to ProjectItems and the quality of the match.
    """
    invoice_item_id: int
    project_item_id: int
    match_type: str  # 'exact', 'fuzzy', 'clarification', 'none'
    name_similarity: Optional[float] = None  # RapidFuzz ratio (0-100), for fuzzy matches
    sku_match: bool  # True if SKUs match exactly
    quantity_match: bool  # True if quantities match


# =============================================================================
# Quantity Discrepancy Schema
# =============================================================================

class QuantityDiscrepancy(BaseSchema):
    """
    Tracks quantity differences between invoice and expected BOM quantities.
    Used for partial shipment detection and clarification flags.
    """
    invoice_item_id: int
    project_item_id: int
    invoice_qty: int
    expected_qty: int
    discrepancy: int  # difference (invoice_qty - expected_qty)


# =============================================================================
# Verification Result Schema
# =============================================================================

class VerificationResult(BaseSchema):
    """
    Complete verification result stored in Invoice.verification_result JSONB.
    Provides structured audit trail of invoice-to-BOM reconciliation.
    """
    verdict: str  # 'verified', 'partial', 'clarification_needed', 'failed'
    matched_items: List[ItemVerification] = []  # Items with successful matches
    fuzzy_matched_items: List[ItemVerification] = []  # Items with fuzzy matches (>85% similarity)
    unmapped_items: List[int] = []  # Invoice item IDs with no BOM match
    quantity_discrepancies: List[QuantityDiscrepancy] = []  # Quantity differences
    extra_items: List[int] = []  # Invoice item IDs not in BOM (extra line items)
    missing_items: List[int] = []  # ProjectItem IDs missing from invoice
    items: List[ItemVerification] = []  # All item verifications (unfiltered)
    verified_at: datetime  # Timestamp of verification

    model_config = ConfigDict(from_attributes=True)
