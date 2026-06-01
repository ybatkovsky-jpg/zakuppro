"""
Health check endpoint for readiness probes.
"""
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """
    Health check endpoint that returns API status.
    Does not require database connection for basic readiness.
    """
    return {"status": "ok"}
