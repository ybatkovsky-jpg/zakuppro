"""
RBAC authorization module for ZakupPro API.

Provides role-based access control (RBAC) dependencies and utilities for FastAPI routers.
Implements permission checks for owner, manager, and warehouse roles with resource-level
ownership filtering.

Permission Matrix:
    owner (OWNER):
        - All endpoints: full CRUD access
        - No ownership restrictions

    manager (MANAGER):
        - Projects: own projects only (owner_id == user.id)
        - Project Items, Purchase Orders, Invoices, Payments, Production Tasks: own projects only
        - Suppliers: read-only access
        - Stock Items: read-only access (view only)
        - All other resources: 403 Forbidden

    warehouse (WAREHOUSE):
        - Stock Items: full CRUD access
        - All other resources: 403 Forbidden

Usage Examples:
    # Role-based endpoint protection
    @router.get("/projects")
    def list_projects(
        user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
        db: Session = Depends(get_db)
    ):
        ...

    # Ownership filtering for managers
    @router.get("/projects")
    def list_projects(
        user: User = Depends(require_role([Role.OWNER, Role.MANAGER])),
        db: Session = Depends(get_db)
    ):
        query = db.query(Project)
        query = apply_ownership_filter(query, Project, user.id, user.role)
        return query.all()

    # Resource-level ownership check
    @router.get("/projects/{project_id}")
    def get_project(
        project_id: int,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        project = db.query(Project).get(project_id)
        require_ownership(project, user.id, user.role)
        return project
"""
from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Query, Session
from sqlalchemy import sql

from backend.auth import get_current_user, get_current_active_user
from backend.database import get_db
from backend.models import User, Role


# =============================================================================
# Exception
# =============================================================================

class PermissionDenied(HTTPException):
    """
    403 Forbidden exception with structured error response.

    Raised when a user lacks required role or ownership for a resource.
    Logs authorization denial details for observability.

    Attributes:
        user_id: ID of the user denied access
        user_role: Role of the user denied access
        endpoint: API endpoint being accessed
        required_permission: Role or ownership condition that was required

    Example response:
        {
            "detail": "Permission denied: manager role cannot access warehouse operations",
            "error_code": "PERMISSION_DENIED",
            "required_role": "owner",
            "user_role": "manager"
        }
    """

    def __init__(
        self,
        detail: str,
        user_id: Optional[int] = None,
        user_role: Optional[str] = None,
        endpoint: Optional[str] = None,
        required_permission: Optional[str] = None
    ):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "detail": detail,
                "error_code": "PERMISSION_DENIED",
                "required_permission": required_permission,
                "user_role": user_role
            }
        )
        # Store for logging
        self.user_id = user_id
        self.user_role = user_role
        self.endpoint = endpoint
        self.required_permission = required_permission


# =============================================================================
# Role Dependencies
# =============================================================================

def require_role(allowed_roles: List[Role]):
    """
    FastAPI dependency factory for role-based endpoint protection.

    Creates a dependency that checks if the current user's role is in the
    allowed list. Raises 403 if role is not allowed.

    Args:
        allowed_roles: List of Role enums permitted to access the endpoint

    Returns:
        Dependency function that returns the authenticated User

    Raises:
        PermissionDenied: If user's role is not in allowed_roles

    Example:
        @router.get("/admin/users")
        def list_users(
            user: User = Depends(require_role([Role.OWNER])),
            db: Session = Depends(get_db)
        ):
            return db.query(User).all()
    """
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role not in allowed_roles:
            allowed_roles_str = ", ".join(r.value for r in allowed_roles)
            raise PermissionDenied(
                detail=f"Role '{current_user.role.value}' not authorized for this endpoint",
                user_id=current_user.id,
                user_role=current_user.role.value,
                required_permission=f"One of: {allowed_roles_str}"
            )
        return current_user

    return role_checker


def require_ownership(resource: object, user_id: int, user_role: Role) -> None:
    """
    Check if user owns a resource or has owner role bypass.

    Used for resource-level ownership validation after fetching a resource.
    Owner role bypasses all ownership checks (full access).
    Manager role requires resource.owner_id == user_id for owned resources.
    Warehouse role is denied for owned resources (should use require_role).

    Args:
        resource: Domain object with owner_id attribute (Project, etc.)
        user_id: ID of the current user
        user_role: Role of the current user

    Raises:
        PermissionDenied: If user lacks ownership and is not an owner
        AttributeError: If resource lacks owner_id attribute

    Example:
        @router.get("/projects/{project_id}")
        def get_project(
            project_id: int,
            user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            project = db.query(Project).get(project_id)
            if not project:
                raise HTTPException(404, "Project not found")
            require_ownership(project, user.id, user.role)
            return project
    """
    # Owner role bypasses ownership checks
    if user_role == Role.OWNER:
        return

    # Check if resource has owner_id attribute
    if not hasattr(resource, 'owner_id'):
        raise AttributeError(
            f"Resource {type(resource).__name__} does not have owner_id attribute. "
            "Ownership check requires owner_id field."
        )

    # Manager must own the resource
    if user_role == Role.MANAGER:
        if resource.owner_id != user_id:
            raise PermissionDenied(
                detail="Access denied: you do not own this resource",
                user_id=user_id,
                user_role=user_role.value,
                required_permission=f"owner_id == {user_id}"
            )

    # Warehouse role denied for owned resources
    if user_role == Role.WAREHOUSE:
        raise PermissionDenied(
            detail="Warehouse role cannot access this resource type",
            user_id=user_id,
            user_role=user_role.value,
            required_permission="owner or manager role"
        )


# =============================================================================
# Query Filtering Utilities
# =============================================================================

def apply_ownership_filter(
    query: Query,
    model: type,
    user_id: int,
    user_role: Role
) -> Query:
    """
    Apply ownership WHERE clause to a SQLAlchemy query based on user role.

    Owner role: no filter (returns original query)
    Manager role: filters to model.owner_id == user_id (if owner_id exists)
    Warehouse role: returns empty query (denied) unless model is StockItem

    Args:
        query: SQLAlchemy Query object to filter
        model: SQLAlchemy model class (Project, ProjectItem, etc.)
        user_id: ID of the current user
        user_role: Role of the current user

    Returns:
        Filtered Query object

    Example:
        @router.get("/projects")
        def list_projects(
            user: User = Depends(get_current_user),
            db: Session = Depends(get_db)
        ):
            query = db.query(Project)
            query = apply_ownership_filter(query, Project, user.id, user.role)
            return query.all()
    """
    # Owner: no ownership restrictions
    if user_role == Role.OWNER:
        return query

    # Manager: filter by owner_id if model has it
    if user_role == Role.MANAGER:
        if hasattr(model, 'owner_id'):
            return query.filter(model.owner_id == user_id)
        # Model without owner_id (e.g., Supplier): no filter, access granted
        return query

    # Warehouse: deny for non-warehouse models
    if user_role == Role.WAREHOUSE:
        # Allow StockItem queries (warehouse domain)
        if model.__name__ == 'StockItem':
            return query
        # Deny all other models
        return query.filter(sql.false())

    return query


def get_readable_models(user_role: Role) -> List[str]:
    """
    Return list of model names a role can read (for validation/logging).

    Args:
        user_role: User's role

    Returns:
        List of model class names permitted for read access

    Example:
        if model.__name__ not in get_readable_models(user.role):
            raise PermissionDenied(...)
    """
    if user_role == Role.OWNER:
        return [
            'User', 'Project', 'ProjectItem', 'Supplier', 'PurchaseOrder',
            'Invoice', 'InvoiceItem', 'Payment', 'StockItem', 'ProductionTask',
            'BankStatement', 'BankTransaction', 'TransactionMatchingAudit',
            'UnresolvedTransaction', 'FailedTask'
        ]
    if user_role == Role.MANAGER:
        return [
            'Project', 'ProjectItem', 'PurchaseOrder', 'Invoice', 'InvoiceItem',
            'Payment', 'ProductionTask', 'Supplier'  # read-only suppliers
        ]
    if user_role == Role.WAREHOUSE:
        return ['StockItem']
    return []


def get_writable_models(user_role: Role) -> List[str]:
    """
    Return list of model names a role can create/update/delete.

    Args:
        user_role: User's role

    Returns:
        List of model class names permitted for write access
    """
    if user_role == Role.OWNER:
        return [
            'User', 'Project', 'ProjectItem', 'Supplier', 'PurchaseOrder',
            'Invoice', 'InvoiceItem', 'Payment', 'StockItem', 'ProductionTask'
        ]
    if user_role == Role.MANAGER:
        return [
            'Project', 'ProjectItem', 'PurchaseOrder', 'Invoice',
            'InvoiceItem', 'Payment', 'ProductionTask'
        ]
    if user_role == Role.WAREHOUSE:
        return ['StockItem']
    return []
