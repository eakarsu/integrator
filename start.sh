#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${NODE_ENV:-development}" == test ]]; then
  CREDENTIAL_ENCRYPTION_KEY="${MEMORY_ENCRYPTION_KEY_BASE64:-}"
  ALLOWED_ORIGINS="http://127.0.0.1:${FRONTEND_PORT:-}"
  VITE_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT:-}/api"
  export CREDENTIAL_ENCRYPTION_KEY ALLOWED_ORIGINS VITE_API_BASE_URL
fi

for port_name in BACKEND_PORT FRONTEND_PORT; do
  value="${!port_name:-}"
  [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 1024 && value <= 65535 )) || { echo "$port_name must be an explicit integer between 1024 and 65535" >&2; exit 1; }
done
[[ "$BACKEND_PORT" != "$FRONTEND_PORT" ]] || { echo "BACKEND_PORT and FRONTEND_PORT must be different" >&2; exit 1; }
PORT="$BACKEND_PORT"
BACKEND_HOST=127.0.0.1
export PORT BACKEND_HOST
for assigned_port in "$BACKEND_PORT" "$FRONTEND_PORT"; do
  lsof -nP -iTCP:"$assigned_port" -sTCP:LISTEN >/dev/null 2>&1 && { echo "Assigned port $assigned_port is occupied" >&2; exit 1; }
done

if [[ ! -f "${project_dir}/.env" ]]; then
  echo "Missing ${project_dir}/.env. Copy .env.example and provide real secrets." >&2
  exit 1
fi
if [[ ! -d "${project_dir}/backend/node_modules" || ! -d "${project_dir}/frontend/node_modules" ]]; then
  echo "Dependencies are not installed. Run npm ci explicitly in backend/ and frontend/." >&2
  exit 1
fi

backend_pid=""
frontend_pid=""
cleanup() {
  [[ -n "${backend_pid}" ]] && kill "${backend_pid}" 2>/dev/null || true
  [[ -n "${frontend_pid}" ]] && kill "${frontend_pid}" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

(cd "${project_dir}/backend" && npm start) &
backend_pid=$!
attempt=0
while ! lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  kill -0 "$backend_pid" 2>/dev/null || { echo "Backend exited before binding $BACKEND_PORT" >&2; wait "$backend_pid"; exit 1; }
  (( attempt < 120 )) || { echo "Backend did not bind $BACKEND_PORT within 30 seconds" >&2; exit 1; }
  sleep 0.25
  attempt=$((attempt + 1))
done
(cd "${project_dir}/frontend" && npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort) &
frontend_pid=$!

echo "API and UI started. Migrations, provisioning, and workers remain explicit commands."
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do sleep 1; done
if ! kill -0 "$backend_pid" 2>/dev/null; then wait "$backend_pid"; else wait "$frontend_pid"; fi
