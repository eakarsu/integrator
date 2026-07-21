# Operations runbook

## Deploy

Run migrations as a one-shot job before API and workers. The Compose definition models that ordering. Never run `provision` in normal startup. Use separate database credentials for migration, runtime, backup, and restore in production, granting each only its required privileges.

Workers use `FOR UPDATE SKIP LOCKED` and expiring leases. Multiple worker replicas are supported. A worker terminated during a run leaves the lease to expire and the run becomes claimable again; a stale worker cannot overwrite the new lease holder's outcome. Queued runs retain the accepted workflow version and automatic attempts send the same per-step idempotency key. An operator-reviewed dead-letter retry adopts the current active workflow revision and increments the retry cycle, producing a new key. Downstream destinations must enforce that key if side effects cannot be safely repeated.

## Alerts

Route structured logs into the platform monitor. Alert on readiness failures, any `dead_letter`, repeated `retry_scheduled` outcomes, queue age, database saturation, authentication spikes, and audit-chain verification failure. Payloads and connector credentials must not be added to logs.

## Incident response

1. Pause the affected workflow to stop new enqueue operations.
2. Preserve audit events and structured logs; verify the chain through `/api/audit/verify`.
3. Disable or rotate affected connection credentials. Updating credentials never returns their previous value.
4. Revoke sessions by changing user status/password/role or calling `/api/auth/logout-all`.
5. Correct and reactivate the workflow, then explicitly retry reviewed dead-letter runs. The retry records the old and new workflow versions in the audit chain.

## Backup and restore

Backups should be encrypted outside this repository, access-controlled, tested on a disposable database, and retained according to an approved policy. `backup.sh` refuses to overwrite an existing path. `restore.sh` requires both an explicit database URL and `CONFIRM_RESTORE=yes`; it replaces objects in the selected database. Always verify the hostname/database and take a new backup before restoration.

After restoring, run the migration command, check readiness, verify the audit chain, compare critical row counts, execute a canary workflow against a non-production endpoint, and record the recovery time and recovery point achieved.

## Secret rotation

Changing `JWT_SECRET` revokes all tokens immediately. Changing `CREDENTIAL_ENCRYPTION_KEY` requires an approved re-encryption procedure; do not simply replace the key while encrypted rows exist. Rotate a connector secret by PATCHing a complete new credential object. History scanning cannot prove ignored local `.env` values were never exposed elsewhere, so suspected real credentials must be rotated at their provider.
