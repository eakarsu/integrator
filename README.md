# Integrator Control Plane

Integrator is a tenant-aware control plane for reliably delivering JSON payloads to approved HTTP integrations. Its supported product boundary is intentionally narrow: an administrator provisions a tenant, an editor configures an approved connection and a versioned workflow, and a worker executes idempotent runs with leases, bounded retries, dead letters, and immutable audit evidence.

## Acceptance criteria

- A user can access only their tenant and only operations permitted by `viewer`, `editor`, or `admin`.
- An editor can configure an HTTP connection without exposing stored credentials in API responses.
- A draft workflow can be activated only when every step references an active connection owned by the same tenant.
- Reusing an `Idempotency-Key` with identical input returns the original run; different input is rejected. Each outbound step also receives a stable run/cycle/step idempotency header.
- Concurrent workers cannot claim the same run. A run executes its queued workflow snapshot, automatic attempts send a stable downstream idempotency key, and an explicit dead-letter retry adopts the reviewed current workflow revision with a new retry-cycle key.
- Every lifecycle change appends to a tenant-specific hash chain that the database prevents clients from changing or deleting.
- API and worker startup fail closed when a required migration is missing or its recorded checksum differs from the repository.
- CI replays migrations on PostgreSQL 17, exercises a real API-to-database-to-worker-to-HTTP-connector journey plus success, retry, dead-letter, duplicate, tenant-boundary, credential, and audit-tamper paths, builds the UI/images, audits dependencies, and scans Git history for secrets.

## Local setup

Requirements: Node.js 22, npm, PostgreSQL 17, and a dedicated database.

1. Copy `.env.example` to `.env` and replace every placeholder. Generate the credential key with `openssl rand -base64 32`.
2. Install dependencies explicitly with `npm ci --prefix backend` and `npm ci --prefix frontend`.
3. Apply versioned migrations with `npm --prefix backend run migrate`.
4. Set the four `PROVISION_*` variables, run `npm --prefix backend run provision` once, then remove those variables from the environment.
5. Start the API/UI with `./start.sh` and start a worker separately with `npm --prefix backend run worker`. Both refuse to operate against missing or checksum-mismatched migrations.

`start.sh` deliberately does not install packages, start or create PostgreSQL, migrate, provision, seed, kill ports, or launch the worker. Those are independent operator decisions.

## API workflow

All protected requests use `Authorization: Bearer <token>`. Log in at `POST /api/auth/login`.

1. `POST /api/connections` with `{name, connectorType: "http", baseUrl, credentials?}`.
2. `POST /api/workflows` with a non-empty `definition.steps` array. Each step names a connection, method, and origin-relative path.
3. `POST /api/workflows/:id/state` with `{status: "active"}`.
4. `POST /api/workflows/:id/runs` with an `Idempotency-Key` header and `{input: {...}}`.
5. Inspect `GET /api/workflows/:id/runs` or `GET /api/workflows/runs/:runId`.

Connection credentials accept a bearer token or API key/header pair, are encrypted with AES-256-GCM, and are never returned. Connector execution requires HTTPS and blocks embedded URL credentials, redirects, oversized responses, unsafe API-key headers, and private/loopback DNS results. Every step receives `Idempotency-Key` and `X-Integrator-Run-Id`; destinations that perform side effects must enforce idempotency. `ALLOW_PRIVATE_CONNECTOR_HOSTS=true` and `ALLOW_INSECURE_CONNECTOR_HTTP=true` exist only for explicit isolated test environments.

## Operations

- Health: `/api/health/live` reports process liveness; `/api/health/ready` verifies PostgreSQL.
- Proxy trust: keep `TRUST_PROXY_HOPS=0` for direct/local access; set the exact trusted hop count only when the API is behind controlled proxies (Compose uses one Nginx hop).
- Logs: the API and worker emit structured JSON with request/run IDs and outcomes, without payloads or credentials.
- Backup: `DATABASE_URL=... ./scripts/backup.sh /absolute/new/backup.dump` refuses overwrite.
- Restore: `DATABASE_URL=... CONFIRM_RESTORE=yes ./scripts/restore.sh /absolute/backup.dump` is deliberately destructive and explicit.
- Audit verification: an admin can call `GET /api/audit/verify`.
- Dead letters: inspect a run, correct the connection/workflow, then `POST /api/workflows/runs/:runId/retry`.

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for incident and recovery procedures. External production gates remain TLS/identity-provider integration, managed secret storage, jurisdiction-specific retention approval, alert routing, load testing, and a demonstrated restore in the target environment.
