"""
Authentication router for ZakupPro API.

Provides login endpoint for JWT token authentication.
Logs failed login attempts for security monitoring.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime
import logging

from backend.database import get_db
from backend.models import User
from backend.schemas import LoginRequest, LoginResponse
from backend.auth import create_access_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Password hashing context using sha256_crypt (reliable cross-platform without external deps)
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password.

    Args:
        plain_password: Plain text password from login request
        hashed_password: Hashed password from database

    Returns:
        True if password matches, False otherwise
    """
    return pwd_context.verify(plain_password, hashed_password)


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    credentials: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
) -> LoginResponse:
    """
    Authenticate user and return JWT access token.

    Validates username/password against database users table.
    Returns JWT token with user role claim for RBAC authorization.

    Args:
        credentials: LoginRequest with username and password
        request: FastAPI Request object for client IP logging
        db: Database session

    Returns:
        LoginResponse with access_token, token_type, and role

    Raises:
        HTTPException 401: If username not found or password invalid
    """
    # Query user by username
    user = db.query(User).filter(User.username == credentials.username).first()

    # Verify user exists and password matches
    if not user or not verify_password(credentials.password, user.hashed_password):
        # Log failed login attempt with username and IP
        client_ip = request.client.host if request.client else "unknown"
        logger.warning(
            f"Failed login attempt for username '{credentials.username}' from IP: {client_ip}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT token with user claims
    access_token = create_access_token(data={
        "user_id": user.id,
        "role": user.role.value
    })

    logger.info(f"User '{user.username}' (role: {user.role.value}) logged in successfully from IP: {request.client.host if request.client else 'unknown'}")

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role
    )
