"""
Invoice Verifier Service for BOM Reconciliation.

This module provides functionality to verify invoice items against project BOM
using exact SKU matching and RapidFuzz fuzzy name matching. It links InvoiceItems
to ProjectItems and stores structured verification results in Invoice.verification_result.

Features:
- Exact SKU matching for direct item linkage
- RapidFuzz fuzzy name matching for similar items (>85% similarity)
- Quantity discrepancy detection
- Structured JSONB verification result storage
- Invoice status update based on verification verdict
"""

from __future__ import annotations

import logging
from typing import Optional, List, Dict, Tuple
from datetime import datetime
from sqlalchemy.orm import Session, joinedload

from backend.models import Invoice, InvoiceItem, ProjectItem, PurchaseOrder
from backend.schemas.verification import (
    VerificationResult,
    ItemVerification,
    QuantityDiscrepancy,
)

# Fuzzy matching thresholds
FUZZY_MATCH_THRESHOLD = 85  # WRatio score for fuzzy match
CLARIFICATION_THRESHOLD = 60  # WRatio score for clarification needed

logger = logging.getLogger(__name__)


class InvoiceVerifier:
    """
    Invoice verifier service for BOM reconciliation.

    Verifies invoice items against project BOM by:
    1. Exact SKU matching → direct linkage
    2. RapidFuzz fuzzy name matching (>85% similarity) → linkage with flag
    3. No match or low similarity → unmapped/clarification status
    4. Quantity validation → discrepancy detection
    """

    def __init__(self, db: Session):
        """
        Initialize invoice verifier with database session.

        Args:
            db: SQLAlchemy database session
        """
        self.db = db

    def verify_invoice(self, invoice_id: int) -> VerificationResult:
        """
        Verify invoice items against project BOM.

        Matches invoice items to ProjectItems using exact SKU matching and
        RapidFuzz fuzzy name matching. Updates InvoiceItem.project_item_id
        for matched items and stores verification result in Invoice.verification_result.

        Args:
            invoice_id: Invoice ID to verify

        Returns:
            VerificationResult with structured verification data

        Raises:
            ValueError: If invoice not found
        """
        logger.info(f"Starting verification for invoice_id={invoice_id}")

        # Fetch Invoice with InvoiceItems (project_item_id is None from S03)
        invoice = self._fetch_invoice_with_items(invoice_id)

        # Fetch PurchaseOrder to get project_id
        purchase_order = self._fetch_purchase_order(invoice.purchase_order_id)

        # Fetch ProjectItems for the project
        project_items = self._fetch_project_items(purchase_order.project_id)

        logger.info(
            f"Verifying {len(invoice.items)} invoice items "
            f"against {len(project_items)} project items"
        )

        # Build SKU lookup for exact matching
        project_items_by_sku = self._build_sku_lookup(project_items)

        # Match invoice items to project items
        item_verifications: List[ItemVerification] = []
        matched_project_item_ids = set()

        for invoice_item in invoice.items:
            verification = self._verify_invoice_item(
                invoice_item,
                project_items,
                project_items_by_sku,
            )
            item_verifications.append(verification)

            if verification.project_item_id:
                # Update InvoiceItem.project_item_id for matched items
                invoice_item.project_item_id = verification.project_item_id
                matched_project_item_ids.add(verification.project_item_id)

                logger.debug(
                    f"Matched invoice_item {invoice_item.id} -> "
                    f"project_item {verification.project_item_id} "
                    f"(type: {verification.match_type}, "
                    f"similarity: {verification.name_similarity})"
                )

        # Detect quantity discrepancies
        quantity_discrepancies = self._detect_quantity_discrepancies(
            item_verifications, project_items
        )

        # Detect extra items (invoice items with no match)
        extra_items = [
            v.invoice_item_id
            for v in item_verifications
            if v.match_type in ("none", "clarification")
        ]

        # Detect missing items (project items with no invoice match)
        missing_items = [
            item.id
            for item in project_items
            if item.id not in matched_project_item_ids
        ]

        # Categorize items by match type
        matched_items = [
            v for v in item_verifications if v.match_type == "exact"
        ]
        fuzzy_matched_items = [
            v for v in item_verifications if v.match_type == "fuzzy"
        ]
        unmapped_items = [
            v.invoice_item_id for v in item_verifications if v.match_type == "none"
        ]

        # Determine overall verdict
        verdict = self._determine_verdict(
            item_verifications,
            quantity_discrepancies,
            extra_items,
            missing_items,
        )

        # Create VerificationResult
        verification_result = VerificationResult(
            verdict=verdict,
            matched_items=matched_items,
            fuzzy_matched_items=fuzzy_matched_items,
            unmapped_items=unmapped_items,
            quantity_discrepancies=quantity_discrepancies,
            extra_items=extra_items,
            missing_items=missing_items,
            items=item_verifications,
            verified_at=datetime.utcnow(),
        )

        # Store verification result in Invoice
        invoice.verification_result = verification_result.model_dump(mode="json")

        # Update Invoice.status based on verdict
        invoice.status = self._map_verdict_to_status(verdict)

        # Commit changes to database
        self.db.commit()

        logger.info(
            f"Verification complete for invoice_id={invoice_id}: "
            f"verdict={verdict}, status={invoice.status}, "
            f"{len(matched_items)} exact, {len(fuzzy_matched_items)} fuzzy, "
            f"{len(unmapped_items)} unmapped, "
            f"{len(quantity_discrepancies)} discrepancies"
        )

        return verification_result

    def _fetch_invoice_with_items(self, invoice_id: int) -> Invoice:
        """Fetch Invoice with InvoiceItems loaded."""
        invoice = (
            self.db.query(Invoice)
            .options(joinedload(Invoice.items))
            .filter(Invoice.id == invoice_id)
            .first()
        )

        if not invoice:
            raise ValueError(f"Invoice with id={invoice_id} not found")

        return invoice

    def _fetch_purchase_order(self, purchase_order_id: int) -> PurchaseOrder:
        """Fetch PurchaseOrder."""
        return (
            self.db.query(PurchaseOrder)
            .filter(PurchaseOrder.id == purchase_order_id)
            .first()
        )

    def _fetch_project_items(self, project_id: int) -> List[ProjectItem]:
        """Fetch all ProjectItems for a project."""
        return (
            self.db.query(ProjectItem)
            .filter(ProjectItem.project_id == project_id)
            .all()
        )

    def _build_sku_lookup(self, project_items: List[ProjectItem]) -> Dict[str, ProjectItem]:
        """Build SKU -> ProjectItem lookup for exact matching."""
        return {item.sku: item for item in project_items if item.sku}

    def _verify_invoice_item(
        self,
        invoice_item: InvoiceItem,
        project_items: List[ProjectItem],
        project_items_by_sku: Dict[str, ProjectItem],
    ) -> ItemVerification:
        """
        Verify a single invoice item against project BOM.

        Args:
            invoice_item: InvoiceItem to verify
            project_items: List of all ProjectItems for the project
            project_items_by_sku: SKU lookup for exact matching

        Returns:
            ItemVerification with match details
        """
        invoice_sku = invoice_item.sku.strip() if invoice_item.sku else ""
        invoice_name = invoice_item.name.strip() if invoice_item.name else ""
        invoice_qty = invoice_item.qty

        # Try exact SKU match first
        if invoice_sku and invoice_sku in project_items_by_sku:
            project_item = project_items_by_sku[invoice_sku]
            qty_match = (invoice_qty == project_item.qty)

            return ItemVerification(
                invoice_item_id=invoice_item.id,
                project_item_id=project_item.id,
                match_type="exact",
                name_similarity=100.0,
                sku_match=True,
                quantity_match=qty_match,
            )

        # No exact SKU match - try fuzzy name matching
        best_match = self._find_best_fuzzy_match(
            invoice_name,
            invoice_sku,
            project_items,
            project_items_by_sku,
        )

        if best_match:
            project_item, similarity = best_match
            qty_match = (invoice_qty == project_item.qty)

            match_type = "fuzzy" if similarity >= FUZZY_MATCH_THRESHOLD else "clarification"

            return ItemVerification(
                invoice_item_id=invoice_item.id,
                project_item_id=project_item.id,
                match_type=match_type,
                name_similarity=similarity,
                sku_match=False,
                quantity_match=qty_match,
            )

        # No match found
        return ItemVerification(
            invoice_item_id=invoice_item.id,
            project_item_id=0,  # No match
            match_type="none",
            name_similarity=None,
            sku_match=False,
            quantity_match=False,
        )

    def _find_best_fuzzy_match(
        self,
        invoice_name: str,
        invoice_sku: str,
        project_items: List[ProjectItem],
        project_items_by_sku: Dict[str, ProjectItem],
    ) -> Optional[Tuple[ProjectItem, float]]:
        """
        Find best fuzzy match using RapidFuzz.

        Args:
            invoice_name: Invoice item name for matching
            invoice_sku: Invoice item SKU (for context)
            project_items: List of ProjectItems to match against
            project_items_by_sku: SKU lookup (excluded from fuzzy search)

        Returns:
            Tuple of (ProjectItem, similarity_score) or None if no good match
        """
        from rapidfuzz import fuzz, process

        if not invoice_name:
            return None

        # Build list of candidate project items (excluding exact SKU matches)
        candidates = [
            item for item in project_items
            if item.sku != invoice_sku or not invoice_sku
        ]

        if not candidates:
            return None

        # Extract project item names for matching
        candidate_names = [item.name for item in candidates if item.name]

        if not candidate_names:
            return None

        # Use RapidFuzz process.extractOne for batch matching
        result = process.extractOne(
            invoice_name,
            candidate_names,
            scorer=fuzz.WRatio,
        )

        if result:
            best_match_name, similarity, _ = result
            if similarity >= CLARIFICATION_THRESHOLD:
                # Find the ProjectItem with this name
                for item in candidates:
                    if item.name == best_match_name:
                        return (item, similarity)

        return None

    def _detect_quantity_discrepancies(
        self,
        item_verifications: List[ItemVerification],
        project_items: List[ProjectItem],
    ) -> List[QuantityDiscrepancy]:
        """
        Detect quantity discrepancies between invoice and BOM.

        Args:
            item_verifications: List of item verification results
            project_items: List of all ProjectItems

        Returns:
            List of QuantityDiscrepancy objects
        """
        discrepancies = []
        project_items_by_id = {item.id: item for item in project_items}

        for verification in item_verifications:
            if verification.project_item_id == 0:
                continue

            project_item = project_items_by_id.get(verification.project_item_id)
            if not project_item:
                continue

            invoice_item = next(
                (v for v in item_verifications if v.invoice_item_id == verification.invoice_item_id),
                None,
            )
            if not invoice_item:
                continue

            # Get invoice quantity from the original invoice item
            # We need to fetch it from the database since ItemVerification doesn't have it
            invoice_item_db = (
                self.db.query(InvoiceItem)
                .filter(InvoiceItem.id == verification.invoice_item_id)
                .first()
            )

            if not invoice_item_db:
                continue

            invoice_qty = invoice_item_db.qty
            expected_qty = project_item.qty

            if invoice_qty != expected_qty:
                discrepancies.append(
                    QuantityDiscrepancy(
                        invoice_item_id=verification.invoice_item_id,
                        project_item_id=verification.project_item_id,
                        invoice_qty=invoice_qty,
                        expected_qty=expected_qty,
                        discrepancy=invoice_qty - expected_qty,
                    )
                )

        return discrepancies

    def _determine_verdict(
        self,
        item_verifications: List[ItemVerification],
        quantity_discrepancies: List[QuantityDiscrepancy],
        extra_items: List[int],
        missing_items: List[int],
    ) -> str:
        """
        Determine overall verification verdict.

        Args:
            item_verifications: List of item verification results
            quantity_discrepancies: List of quantity discrepancies
            extra_items: List of extra invoice item IDs
            missing_items: List of missing project item IDs

        Returns:
            Verdict string: 'verified', 'partial', 'clarification_needed', or 'failed'
        """
        # Count matches by type
        exact_matches = sum(1 for v in item_verifications if v.match_type == "exact")
        fuzzy_matches = sum(1 for v in item_verifications if v.match_type == "fuzzy")
        clarification_needed = sum(1 for v in item_verifications if v.match_type == "clarification")
        unmapped = sum(1 for v in item_verifications if v.match_type == "none")

        total_items = len(item_verifications)

        # Failed: no items matched
        if exact_matches + fuzzy_matches == 0:
            return "failed"

        # Clarification needed: fuzzy matches or low similarity items
        if clarification_needed > 0 or fuzzy_matches > 0:
            return "clarification_needed"

        # Partial: quantity discrepancies or missing/extra items
        if quantity_discrepancies or extra_items or missing_items:
            return "partial"

        # Verified: all items matched exactly
        if exact_matches == total_items:
            return "verified"

        # Default to partial
        return "partial"

    def _map_verdict_to_status(self, verdict: str) -> str:
        """
        Map verification verdict to Invoice.status (Russian).

        Args:
            verdict: Verification verdict string

        Returns:
            Russian status string for Invoice.status
        """
        status_map = {
            "verified": "Сверен",  # Verified
            "partial": "Ошибки",  # Errors/discrepancies
            "clarification_needed": "Ожидает сверки",  # Awaiting verification
            "failed": "Ошибки",  # Errors
        }
        return status_map.get(verdict, "Ожидает сверки")


def verify_invoice(invoice_id: int, db: Session) -> VerificationResult:
    """
    Verify invoice items against project BOM.

    This is a convenience function that creates an InvoiceVerifier
    and verifies the invoice.

    Args:
        invoice_id: Invoice ID to verify
        db: SQLAlchemy database session

    Returns:
        VerificationResult with structured verification data

    Raises:
        ValueError: If invoice not found
    """
    verifier = InvoiceVerifier(db)
    return verifier.verify_invoice(invoice_id)
