"""
FastAPI application entry point for ZakupPro API.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import health

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
app.include_router(health.router)


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "ZakupPro API",
        "version": "0.1.0",
        "docs": "/docs",
    }
