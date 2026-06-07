# Multi-stage Dockerfile for ZakupPro FastAPI Backend
# Stage 1: Builder - compiles and installs dependencies
FROM python:3.11-slim AS builder

# Set environment variables for Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies required for some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt


# Stage 2: Final - minimal runtime image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder stage
COPY --from=builder /opt/venv /opt/venv

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Copy application code into /app/backend/ so that 'backend.main' is importable
COPY --chown=appuser:appuser . /app/backend/

# Create data directories for uploads and health check heartbeat files
# These must be owned by appuser since the volume mount inherits ownership
RUN mkdir -p /data/uploads /data/health && chown -R appuser:appuser /data

# Switch to non-root user
USER appuser

# Expose API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run migrations then start uvicorn server
# Working dir is /app, module path is backend.main
CMD ["sh", "-c", "cd /app/backend && alembic upgrade head && cd /app && uvicorn backend.main:app --host 0.0.0.0 --port 8000"]
