"""
FastAPI application entry point for ZakupPro API.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import (
    stats,
    frontend_compat,
    auth,
    health,
    projects,
    project_items,
    suppliers,
    stock_items,
    purchase_orders,
    invoices,
    payments,
    unresolved_transactions,
    production_tasks,
    analytics,
    admin_failed_tasks,
    assistant,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events.

    On startup: logs that the server is starting.
    On shutdown: logs shutdown — placeholder for future cleanup
    (DB connection pools, Celery shutdown, etc.).
    """
    logger.info("FastAPI starting up...")
    yield
    logger.info("FastAPI shutting down...")


# Create FastAPI application
app = FastAPI(
    title="ZakupPro API",
    version="0.1.0",
    description="API for procurement management system",
    lifespan=lifespan,
)

# Configure CORS middleware
# Origins are configurable via CORS_ORIGINS env var (comma-separated).
# Default: local dev origins only.
import os
_cors_origins_str = os.getenv("CORS_ORIGINS", "")
if _cors_origins_str:
    # Production: explicit list from env
    _cors_origins = [o.strip() for o in _cors_origins_str.split(",") if o.strip()]
else:
    # Development defaults
    _cors_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# Include routers
app.include_router(stats.router)
app.include_router(frontend_compat.router)
app.include_router(auth.router)
app.include_router(health.router)
app.include_router(projects.router)
app.include_router(project_items.router)
app.include_router(suppliers.router)
app.include_router(stock_items.router)
app.include_router(purchase_orders.router)
app.include_router(invoices.router)
app.include_router(payments.router)
app.include_router(unresolved_transactions.router)
app.include_router(production_tasks.router)
app.include_router(analytics.router)
app.include_router(admin_failed_tasks.router)
app.include_router(assistant.router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "ZakupPro API",
        "version": "0.1.0",
        "docs": "/docs",
    }


