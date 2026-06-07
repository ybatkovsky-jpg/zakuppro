#!/usr/bin/env bash
#
# safe-rebuild.sh — Rebuild and restart Docker containers WITHOUT losing data
#
# USAGE:
#   ./safe-rebuild.sh              # Rebuild frontend only (most common)
#   ./safe-rebuild.sh --all        # Rebuild all services
#   ./safe-rebuild.sh --frontend   # Rebuild frontend only
#   ./safe-rebuild.sh --backend    # Rebuild backend services only
#
# IMPORTANT: This script NEVER removes Docker volumes, so your PostgreSQL
# database, RabbitMQ data, and uploads are always preserved.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()  { echo -e "${CYAN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Parse arguments
TARGET="${1:---frontend}"

case "$TARGET" in
  --frontend)
    SERVICES="frontend"
    ;;
  --backend)
    SERVICES="api email-worker celery-worker telegram-bot"
    ;;
  --all)
    SERVICES="frontend api email-worker celery-worker telegram-bot"
    ;;
  *)
    echo "Usage: $0 [--frontend|--backend|--all]"
    exit 1
    ;;
esac

log "Safe rebuild for: $SERVICES"
log "Working directory: $SCRIPT_DIR"

# Step 1: Pull latest code
log "Pulling latest code from Git..."
git pull origin main || warn "Git pull failed — continuing with local code"

# Step 2: Verify .env exists
if [ ! -f .env ]; then
  err ".env file not found! Create it from .env.example first."
fi

# Step 3: Check current container status
log "Current container status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || true

# Step 4: Verify PostgreSQL is healthy and volume exists
log "Verifying PostgreSQL data volume..."
PG_VOLUME="zakuppro_postgres_data"
if docker volume inspect "$PG_VOLUME" &>/dev/null; then
  ok "PostgreSQL volume '$PG_VOLUME' exists — data will be preserved"
else
  warn "PostgreSQL volume not found — database may be empty after rebuild"
fi

# Step 5: Rebuild and restart ONLY the specified services
# The key is: we use 'docker compose up --build -d' which recreates
# containers but does NOT remove volumes. We explicitly AVOID
# 'docker compose down -v' which would delete volumes.
log "Rebuilding services: $SERVICES"
docker compose build $SERVICES

log "Restarting services (preserving database)..."
# Stop only the target services, not the database
docker compose stop $SERVICES 2>/dev/null || true

# Remove old containers for target services so they get recreated
docker compose rm -f $SERVICES 2>/dev/null || true

# Start everything (database will just continue running if already up)
docker compose up -d

# Step 6: Wait for services to be healthy
log "Waiting for services to become healthy..."
sleep 5

MAX_RETRIES=30
RETRY=0
ALL_HEALTHY=false

while [ $RETRY -lt $MAX_RETRIES ]; do
  UNHEALTHY=$(docker compose ps --format json 2>/dev/null | \
    python3 -c "
import sys, json
for line in sys.stdin:
    try:
        obj = json.loads(line)
        health = obj.get('Health', obj.get('Status', ''))
        name = obj.get('Name', obj.get('Service', ''))
        if 'unhealthy' in health.lower() or ('up' in health.lower() and 'healthy' not in health.lower() and 'running' not in health.lower()):
            print(name)
    except: pass
" 2>/dev/null | head -5 || echo "")

  if [ -z "$UNHEALTHY" ]; then
    ALL_HEALTHY=true
    break
  fi

  RETRY=$((RETRY + 1))
  log "  Waiting... ($RETRY/$MAX_RETRIES) — some services still starting"
  sleep 3
done

if [ "$ALL_HEALTHY" = true ]; then
  ok "All services are healthy!"
else
  warn "Some services may still be starting. Check with: docker compose ps"
fi

# Step 7: Show final status
echo ""
log "Final container status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || true

echo ""
ok "Rebuild complete! Data has been preserved."
echo ""
log "TIP: If your browser shows old UI, do a hard refresh (Ctrl+Shift+R)"
log "TIP: To check database, run: docker compose exec db psql -U postgres -d zakuppro -c '\\dt'"
