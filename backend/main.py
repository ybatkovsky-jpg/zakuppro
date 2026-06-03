"""
FastAPI application entry point for ZakupPro API.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import (
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
)

# Create FastAPI application
app = FastAPI(
    title="ZakupPro API",
    version="0.1.0",
    description="API for procurement management system",
)

# Configure CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
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


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "ZakupPro API",
        "version": "0.1.0",
        "docs": "/docs",
    }
