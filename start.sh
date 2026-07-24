#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
# shellcheck disable=SC1091
source "$project_dir/.env"
set +a

: "${BACKEND_PORT:?BACKEND_PORT is required}"
: "${FRONTEND_PORT:?FRONTEND_PORT is required}"
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  [[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1024 && port <= 65535 )) || { echo "Ports must be integers from 1024 through 65535" >&2; exit 1; }
done
[[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo "BACKEND_PORT and FRONTEND_PORT must differ" >&2; exit 1; }
for port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && { echo "Port $port is occupied" >&2; exit 1; }
done
[[ -d "$project_dir/backend/node_modules" && -d "$project_dir/frontend/node_modules" ]] || { echo "Dependencies are missing; run npm ci in backend and frontend" >&2; exit 1; }

export PORT="$BACKEND_PORT" BACKEND_HOST=127.0.0.1
export ALLOWED_ORIGINS="http://127.0.0.1:$FRONTEND_PORT"
export PROVISION_TENANT_NAME="${PROVISION_TENANT_NAME:-Runtime Acceptance}"

retry() {
  local attempt
  for attempt in 1 2 3 4 5; do
    "$@" && return 0
    (( attempt < 5 )) || return 1
    echo "Startup preparation attempt $attempt failed; retrying" >&2
    sleep 2
  done
}
retry bash -c 'cd "$1" && npm run migrate' _ "$project_dir/backend"
retry bash -c 'cd "$1" && npm run provision' _ "$project_dir/backend"

backend_pid=''
frontend_pid=''
cleanup() {
  [[ -n "$frontend_pid" ]] && kill "$frontend_pid" 2>/dev/null || true
  [[ -n "$backend_pid" ]] && kill "$backend_pid" 2>/dev/null || true
  [[ -n "$frontend_pid" ]] && wait "$frontend_pid" 2>/dev/null || true
  [[ -n "$backend_pid" ]] && wait "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "$project_dir/backend" && exec npm start) & backend_pid=$!
for _ in $(seq 1 120); do
  curl --fail --silent "http://127.0.0.1:$BACKEND_PORT/api/health/ready" >/dev/null 2>&1 && break
  kill -0 "$backend_pid" 2>/dev/null || { echo "Backend exited during startup" >&2; wait "$backend_pid"; exit 1; }
  sleep 0.25
done
curl --fail --silent "http://127.0.0.1:$BACKEND_PORT/api/health/ready" >/dev/null || { echo "Backend readiness timed out" >&2; exit 1; }
(cd "$project_dir/frontend" && exec npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) & frontend_pid=$!

echo "Integrator is available at http://127.0.0.1:$FRONTEND_PORT (API $BACKEND_PORT)"
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do sleep 1; done
echo "A service exited unexpectedly" >&2
exit 1
