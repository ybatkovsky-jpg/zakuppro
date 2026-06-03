"""
JWT authentication module for ZakupPro API.

Provides JWT token creation, verification, and user extraction dependencies.
Implements role-based access control (RBAC) with owner, manager, and warehouse roles.
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import os
from dotenv import load_dotenv

from backend.database import get_db
from backend.models import User
from backend.schemas import TokenData, Role

load_dotenv()


# =============================================================================
# Configuration
# =============================================================================

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


# =============================================================================
# OAuth2 Scheme
# =============================================================================

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


# =============================================================================
# Token Creation
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token with user claims.

    Args:
        data: Dictionary containing user_id and role
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# =============================================================================
# Token Verification
# =============================================================================

def verify_token(token: str) -> TokenData:
    """
    Verify and decode JWT token, return user claims.

    Args:
        token: JWT token string

    Returns:
        TokenData with user_id and role

    Raises:
        HTTPException 401: If token is expired, invalid, or missing required claims
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        role: str = payload.get("role")

        if user_id is None or role is None:
            raise credentials_exception

        return TokenData(user_id=user_id, role=Role(role))

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError:
        raise credentials_exception


# =============================================================================
# User Dependency
# =============================================================================

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    FastAPI dependency to extract and validate current user from JWT token.

    Usage in route handlers:
        user: User = Depends(get_current_user)

    Args:
        token: JWT from Authorization header (via oauth2_scheme)
        db: Database session

    Returns:
        User object from database

    Raises:
        HTTPException 401: If token invalid/expired or user not found
    """
    token_data = verify_token(token)

    user = db.query(User).filter(User.id == token_data.user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency to ensure user account is active.
    Extends get_current_user for future account status features.

    Args:
        current_user: User from get_current_user dependency

    Returns:
        Active user object

    Raises:
        HTTPException 400: If user account is inactive
    """
    # Future: Add is_active field to User model and check here
    # if not current_user.is_active:
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
