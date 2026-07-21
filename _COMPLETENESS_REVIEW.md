# Completeness Review: integrator

**Review date:** 2026-07-18

## Assessment basis

Static inspection of project-owned source and configuration only; no dependency installation, build, database migration, external-service call, or runtime launch was performed. The scan considered 96 project files (85 source files), 2 manifest(s), 0 test-like file(s), and 0 CI workflow(s), excluding dependency/generated directories.

## Classification

**Prototype-demo**

This is a prototype/demo for application workflow. Generated gap/demo patterns are present: it contains 85 source files and visible routes/pages in `frontend/`, `backend/`, but those surfaces are not evidence of durable domain execution, verified integrations, or operational completion.

## Why it is not complete

- Generated gap/visualization routes describe missing capabilities or simulate recommendations; they do not implement the underlying domain operation.
- Generic LLM calls are used as product behavior without enough typed tools, grounded evidence, deterministic rules, or output evaluation.
- Mock, demo, sample, fixture, or placeholder behavior remains in executable/product paths.
- No recognizable project-owned automated tests were found for the main workflow.
- No checked-in CI workflow proves builds, tests, migrations, and security checks on every change.

## Needed features

1. Define the primary user and acceptance criteria, then complete one end-to-end workflow against persistent data instead of demo fixtures.
2. Replace mocks, placeholders, and generic AI responses with validated domain services and explicit failure/retry behavior.
3. Implement secure identity, role/tenant boundaries, input validation, secrets handling, and auditable state changes.
4. Add representative automated tests, CI quality gates, environment documentation, migrations, observability, backup, and deployment configuration.
5. Add risk-based unit, integration, and end-to-end tests in CI, including migration and failure-path coverage.

## Risks or launch blockers

- Credential/configuration exposure: environment files are present in the repository tree and must be checked against Git history and rotated if real.
- Weak/fallback secret patterns can permit forged sessions or accidental insecure deployments.
- Automation contains destructive process, filesystem, or database operations; do not run it on a shared machine without review.
- Startup appears coupled to seed/migration behavior, risking data mutation or non-repeatable launches.

## Evidence inspected

- `backend/src/middleware/auth.js:3`
- `backend/src/server.js:93`
- `backend/src/server.js`
- `frontend/src/App.jsx`
- `backend/package.json`
- `start.sh`

## Recommended next action

Stop adding generated pages; prove one application workflow workflow against real services and persistent state, with tests and measurable acceptance criteria.

## Implementation progress (2026-07-20)

**Status: all five source-actionable needed-feature groups are implemented and independently verified.**

1. The supported product boundary is now an explicit tenant administrator/editor/viewer journey: provision an account, configure an approved HTTP connection, create and activate a versioned workflow, enqueue an idempotent run, execute it through a leased worker, inspect success or failure evidence, cancel pending work, and repair/retry a reviewed dead letter. PostgreSQL is authoritative for identities, connections, workflow revisions, immutable run snapshots, attempts, steps, and audit events. `README.md` records measurable acceptance criteria, and the generated gap, visualization, marketplace, generic-AI, mock CRUD, demo seed, and embedded-credential surfaces were removed from the executable API and UI.
2. The HTTP connector is a typed, fail-closed domain adapter with origin confinement, DNS/private-address policy, HTTPS-by-default enforcement, redirect rejection, bounded time and response size, encrypted bearer/API-key credentials, explicit retryability, expiring worker leases, bounded exponential retry, dead-letter state, and manual recovery. Queued runs retain the accepted workflow definition and controls even if an editor later changes the workflow. Automatic attempts send a stable per-step `Idempotency-Key`; a reviewed dead-letter retry adopts the current active workflow revision, increments its retry cycle, and records the version change in the audit chain. No connector failure is converted into synthetic success.
3. JWT issuer/audience/algorithm checks, live database-backed account/tenant status and authorization version checks, `viewer`/`editor`/`admin` gates, suspended-tenant revocation, strict body/parameter validation, explicit CORS origins, login throttling, secure headers, AES-256-GCM credential envelopes, non-returning credential APIs, and same-tenant database foreign keys now enforce identity and tenant boundaries. Lifecycle mutations append to a tenant-serialized SHA-256 chain protected from update/delete by database triggers. Current source and the full reachable Git history passed Gitleaks with no findings (the history scan reported six commits processed); the ignored local `.env` files were not read or modified and any value that is real still requires provider-side rotation if exposure is suspected.
4. Two checksum-pinned migrations, repeatable migration and explicit provisioning commands, fail-closed API/worker schema checks, liveness/readiness endpoints, request/run structured logs without payloads or credentials, guarded backup/restore scripts, an environment template, operations and incident runbooks, unprivileged backend packaging, Nginx frontend packaging, Compose service ordering, and checked-in CI are present. `start.sh` only starts already-installed API/UI processes; it does not install, migrate, provision, seed, create a database, kill ports, or start a worker.
5. Fourteen automated checks now cover configuration fail-closed behavior, schema omission/checksum mismatch, canonical idempotency hashes, retry/cancel policy, SSRF address classification, request/response payload boundaries, tenant and role isolation, invalid IDs, session and suspended-tenant revocation, concurrent worker claims, exact/conflicting replay, immutable audit evidence, automatic retry/dead-letter behavior, manual repair/retry, and a live API → PostgreSQL → worker → encrypted HTTP connector journey that proves credential delivery, workflow snapshotting, downstream idempotency keys, recovery, and cancellation. CI applies both migrations twice on PostgreSQL 17, runs the full suite, builds the frontend and production images, audits both dependency trees, validates Compose, and scans full Git history.

Independent validation used `integrator_validation`: migration `002_run_snapshots_and_tenant_integrity.sql` applied cleanly and the two-migration chain replayed without changes; all 14 tests passed with no skips; backend syntax checks and the Vite 8 production build passed; backend and frontend audits each reported zero vulnerabilities and CI enforces that result at the low-severity threshold; Compose configuration, Bash/POSIX shell syntax, and `git diff --check` passed; and current-source plus full-history Gitleaks scans found no leaks. A production-mode API started only after the schema check, returned `200` readiness with both migrations, and rejected an unapproved origin with `403`. The backup script produced a real custom-format dump, the guarded restore script restored it into a fresh database, both migrations remained current, the restored rehearsal contained 2 tenants, 1 workflow, and 4 runs, and both tenant audit chains verified (including a 16-event chain). The local Docker daemon is unavailable, so images were not built locally; CI retains the image-build gate.

Production launch still requires managed PostgreSQL and secret/KMS integration, TLS and production identity policy, real connector credentials and provider acceptance, downstream idempotency enforcement, network-level egress controls against DNS-rebinding races, alert/on-call routing, approved retention, load and lease/clock-skew testing, a restore rehearsal in the target platform, and staging exercises for provider outage, partial side effects, retry, and dead-letter review. Suspected real values in ignored local environment files must be rotated; repository scans cannot prove they were never disclosed elsewhere.

## Isolated startup and login verification (2026-07-20)

The no-argument launcher now requires distinct assigned API/UI ports, refuses occupied ports, binds both processes to `127.0.0.1`, starts the API before exposing the UI, and supervises only its owned processes using macOS-compatible Bash. In isolated acceptance it maps the validator encryption key, CORS origin, and frontend API URL without using a default port. Migration and administrator provisioning remain separate; `create-admin` is acknowledgement-gated, consumes validator credentials, and refuses an existing identity.

On disposable PostgreSQL `55665`, the API and UI used `6138` and `6139`. The first acceptance attempt provisioned a persisted tenant administrator, completed password login, received an issuer/audience-bound bearer token, and passed the live database-revalidated `/api/auth/me` check: `API_VERIFIED/startup_login_session_api`. Backend syntax checks, all 14/14 unit/database/HTTP/worker tests, and the Vite production build passed. All assigned listeners were released afterward.
