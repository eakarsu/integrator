#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
if [[ $# -ne 1 ]]; then
  echo "Usage: DATABASE_URL=... $0 /absolute/path/backup.dump" >&2
  exit 1
fi

output_path="$1"
if [[ "${output_path}" != /* ]]; then
  echo "Backup target must be an absolute path" >&2
  exit 1
fi
if [[ -e "${output_path}" ]]; then
  echo "Refusing to overwrite existing backup: ${output_path}" >&2
  exit 1
fi

pg_dump --format=custom --no-owner --no-acl --file="${output_path}" "${DATABASE_URL}"
echo "Backup created at ${output_path}"
