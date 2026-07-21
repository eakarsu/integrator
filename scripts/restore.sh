#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: DATABASE_URL=... CONFIRM_RESTORE=yes $0 /absolute/path/backup.dump" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Set CONFIRM_RESTORE=yes after verifying the target DATABASE_URL" >&2
  exit 1
fi

pg_restore --exit-on-error --single-transaction --clean --if-exists --no-owner --no-acl --dbname="${DATABASE_URL}" "$1"
echo "Restore completed"
