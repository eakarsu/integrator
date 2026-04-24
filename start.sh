#!/bin/bash
set -euo pipefail

# ============================================================
# System Integrator - Startup Script
# ============================================================

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Globals ---
BACKEND_PID=""
FRONTEND_PID=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Helper functions ---
log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "${CYAN}${BOLD}>>> $1${NC}"; }

# --- Cleanup on exit ---
cleanup() {
    echo ""
    log_warn "Shutting down..."

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        log_info "Stopping backend (PID $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        log_info "Stopping frontend (PID $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
    fi

    log_success "All processes stopped. Goodbye!"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# --- Banner ---
echo ""
echo -e "${CYAN}${BOLD}============================================================${NC}"
echo -e "${CYAN}${BOLD}       System Integrator - Starting...                      ${NC}"
echo -e "${CYAN}${BOLD}============================================================${NC}"
echo ""

# --- Step 1: Load .env ---
log_step "Loading environment variables"

ENV_FILE="${SCRIPT_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_error ".env file not found at ${ENV_FILE}"
    exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
log_success "Environment variables loaded from .env"

# --- Step 2: Kill processes on required ports ---
log_step "Cleaning up ports ${PORT} and ${FRONTEND_PORT}"

kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_warn "Killing process(es) on port ${port}: ${pids}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        log_info "Port ${port} is free"
    fi
}

kill_port "$PORT"
kill_port "$FRONTEND_PORT"

# --- Step 3: Check PostgreSQL ---
log_step "Checking PostgreSQL"

if command -v pg_isready &>/dev/null; then
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" &>/dev/null; then
        log_success "PostgreSQL is running on ${DB_HOST}:${DB_PORT}"
    else
        log_warn "PostgreSQL is not running. Attempting to start..."
        if command -v brew &>/dev/null; then
            brew services start postgresql@14 2>/dev/null \
                || brew services start postgresql@15 2>/dev/null \
                || brew services start postgresql 2>/dev/null \
                || { log_error "Failed to start PostgreSQL via brew"; exit 1; }
        elif command -v pg_ctl &>/dev/null; then
            pg_ctl -D /usr/local/var/postgres start 2>/dev/null \
                || pg_ctl -D /var/lib/postgresql/data start 2>/dev/null \
                || { log_error "Failed to start PostgreSQL via pg_ctl"; exit 1; }
        else
            log_error "Cannot find a way to start PostgreSQL. Please start it manually."
            exit 1
        fi
        # Wait for PostgreSQL to be ready
        for i in $(seq 1 10); do
            if pg_isready -h "$DB_HOST" -p "$DB_PORT" &>/dev/null; then
                break
            fi
            if [ "$i" -eq 10 ]; then
                log_error "PostgreSQL failed to start within 10 seconds"
                exit 1
            fi
            sleep 1
        done
        log_success "PostgreSQL started successfully"
    fi
else
    log_warn "pg_isready not found; skipping PostgreSQL readiness check"
fi

# --- Step 4: Check / create database ---
log_step "Checking database '${DB_NAME}'"

DB_EXISTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
    log_success "Database '${DB_NAME}' already exists"
else
    log_info "Creating database '${DB_NAME}'..."
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null \
        || psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null \
        || { log_error "Failed to create database '${DB_NAME}'"; exit 1; }
    log_success "Database '${DB_NAME}' created"
fi

# --- Step 5: Install backend dependencies ---
log_step "Installing backend dependencies"

if [ ! -d "${SCRIPT_DIR}/backend" ]; then
    log_error "backend/ directory not found"
    exit 1
fi

(cd "${SCRIPT_DIR}/backend" && npm install --no-audit --no-fund) \
    || { log_error "Backend npm install failed"; exit 1; }
log_success "Backend dependencies installed"

# --- Step 6: Install frontend dependencies ---
log_step "Installing frontend dependencies"

if [ ! -d "${SCRIPT_DIR}/frontend" ]; then
    log_error "frontend/ directory not found"
    exit 1
fi

(cd "${SCRIPT_DIR}/frontend" && npm install --no-audit --no-fund) \
    || { log_error "Frontend npm install failed"; exit 1; }
log_success "Frontend dependencies installed"

# --- Step 7: Run seed script ---
log_step "Running database seed script"

SEED_FILE="${SCRIPT_DIR}/backend/src/seeds/seed.js"
if [ -f "$SEED_FILE" ]; then
    (cd "${SCRIPT_DIR}/backend" && node src/seeds/seed.js) \
        || { log_warn "Seed script exited with an error (non-fatal, continuing)"; }
    log_success "Seed script completed"
else
    log_warn "Seed file not found at ${SEED_FILE}, skipping"
fi

# --- Step 8: Start backend ---
log_step "Starting backend (nodemon) on port ${PORT}"

(cd "${SCRIPT_DIR}/backend" && npx nodemon src/server.js) &
BACKEND_PID=$!
log_info "Backend started with PID ${BACKEND_PID}"

# Give the backend a moment to initialize
sleep 2

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_error "Backend process died unexpectedly"
    exit 1
fi

# --- Step 9: Start frontend ---
log_step "Starting frontend (vite) on port ${FRONTEND_PORT}"

(cd "${SCRIPT_DIR}/frontend" && npx vite --port "$FRONTEND_PORT") &
FRONTEND_PID=$!
log_info "Frontend started with PID ${FRONTEND_PID}"

sleep 2

if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    log_error "Frontend process died unexpectedly"
    exit 1
fi

# --- Ready ---
echo ""
echo -e "${GREEN}${BOLD}============================================================${NC}"
echo -e "${GREEN}${BOLD}  System Integrator is running!${NC}"
echo -e "${GREEN}${BOLD}============================================================${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}  ${CYAN}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  ${BOLD}Backend:${NC}   ${CYAN}http://localhost:${PORT}${NC}"
echo ""
echo -e "  Press ${YELLOW}Ctrl+C${NC} to stop all services"
echo ""

# --- Wait for child processes ---
wait
