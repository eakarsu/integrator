const crypto = require('node:crypto');
const db = require('../db');
const { HttpError } = require('../errors');
const { appendAudit, canonicalJson } = require('./audit');
const { executeHttpStep } = require('./httpAdapter');

const terminalStatuses = new Set(['succeeded', 'dead_letter', 'cancelled']);

function requestHash(input) {
  return crypto.createHash('sha256').update(canonicalJson(input)).digest('hex');
}

function retryDelay(attempt, baseDelayMs) {
  const exponential = Math.min(baseDelayMs * (2 ** Math.max(0, attempt - 1)), 60 * 60 * 1000);
  return Math.min(exponential + Math.floor(exponential * 0.1), 60 * 60 * 1000);
}

async function enqueueRun({ tenantId, actorId, workflowId, idempotencyKey, input }) {
  const hash = requestHash(input);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(async (client) => {
        const workflowResult = await client.query(
          `SELECT id, status, version, definition, max_attempts, retry_delay_ms
             FROM workflows WHERE id = $1 AND tenant_id = $2 FOR SHARE`,
          [workflowId, tenantId],
        );
        const workflow = workflowResult.rows[0];
        if (!workflow) throw new HttpError(404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
        if (workflow.status !== 'active') throw new HttpError(409, 'WORKFLOW_NOT_ACTIVE', 'Only active workflows can run');

        const existing = await client.query(
          `SELECT * FROM workflow_runs WHERE tenant_id = $1 AND workflow_id = $2 AND idempotency_key = $3`,
          [tenantId, workflowId, idempotencyKey],
        );
        if (existing.rows[0]) {
          if (existing.rows[0].request_hash !== hash) {
            throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with different input');
          }
          return { run: existing.rows[0], replayed: true };
        }

        const inserted = await client.query(
          `INSERT INTO workflow_runs
             (tenant_id, workflow_id, workflow_version, workflow_definition, max_attempts, retry_delay_ms,
              requested_by, idempotency_key, request_hash, status, input, next_attempt_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'queued',$10,NOW()) RETURNING *`,
          [tenantId, workflowId, workflow.version, workflow.definition, workflow.max_attempts,
            workflow.retry_delay_ms, actorId, idempotencyKey, hash, input],
        );
        await appendAudit(client, {
          tenantId,
          actorId,
          action: 'workflow_run.queued',
          resourceType: 'workflow_run',
          resourceId: inserted.rows[0].id,
          details: { workflowId, idempotencyKey },
        });
        return { run: inserted.rows[0], replayed: false };
      }, { isolationLevel: 'SERIALIZABLE' });
    } catch (error) {
      if (attempt < 3 && (error.code === '40001' || error.code === '23505')) continue;
      throw error;
    }
  }
  throw new Error('Unable to enqueue workflow run');
}

async function claimNextRun(workerId, leaseSeconds = 900) {
  const result = await db.query(
    `WITH candidate AS (
       SELECT id FROM workflow_runs
        WHERE ((status IN ('queued','retry_scheduled') AND next_attempt_at <= NOW())
           OR (status = 'running' AND lease_expires_at < NOW()))
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED LIMIT 1
     )
     UPDATE workflow_runs AS run
        SET status = 'running', attempts = attempts + 1, leased_by = $1,
            lease_expires_at = NOW() + ($2 * INTERVAL '1 second'), started_at = COALESCE(started_at, NOW()),
            updated_at = NOW()
       FROM candidate WHERE run.id = candidate.id RETURNING run.*`,
    [workerId, leaseSeconds],
  );
  return result.rows[0] || null;
}

async function markRunSucceeded(run, output) {
  await db.transaction(async (client) => {
    const updated = await client.query(
      `UPDATE workflow_runs SET status='succeeded', output=$1, error=NULL,
          completed_at=NOW(), lease_expires_at=NULL, leased_by=NULL, updated_at=NOW()
        WHERE id=$2 AND tenant_id=$3 AND status='running' AND leased_by=$4
          AND lease_expires_at > NOW() RETURNING *`,
      [output, run.id, run.tenant_id, run.leased_by],
    );
    if (!updated.rows[0]) throw new Error('Run lease was lost before completion');
    await appendAudit(client, {
      tenantId: run.tenant_id,
      actorId: null,
      action: 'workflow_run.succeeded',
      resourceType: 'workflow_run',
      resourceId: run.id,
      details: { attempt: run.attempts },
    });
  });
}

async function markRunFailed(run, error, workflow) {
  const retryable = error.retryable !== false;
  const shouldRetry = retryable && run.attempts < workflow.max_attempts;
  const status = shouldRetry ? 'retry_scheduled' : 'dead_letter';
  const nextAttemptAt = shouldRetry
    ? new Date(Date.now() + retryDelay(run.attempts, workflow.retry_delay_ms))
    : null;
  await db.transaction(async (client) => {
    const updated = await client.query(
      `UPDATE workflow_runs SET status=$1::varchar, error=$2, next_attempt_at=$3,
          completed_at=CASE WHEN $1::varchar='dead_letter' THEN NOW() ELSE NULL END,
          lease_expires_at=NULL, leased_by=NULL, updated_at=NOW()
        WHERE id=$4 AND tenant_id=$5 AND status='running' AND leased_by=$6
          AND lease_expires_at > NOW() RETURNING *`,
      [status, { message: error.message, retryable, code: error.code || null }, nextAttemptAt,
        run.id, run.tenant_id, run.leased_by],
    );
    if (!updated.rows[0]) throw new Error('Run lease was lost before failure handling');
    await appendAudit(client, {
      tenantId: run.tenant_id,
      actorId: null,
      action: `workflow_run.${status}`,
      resourceType: 'workflow_run',
      resourceId: run.id,
      details: { attempt: run.attempts, retryable, message: error.message, nextAttemptAt },
    });
  });
  return status;
}

async function executeClaimedRun(run, adapter = executeHttpStep) {
  let current = run.input;
  try {
    for (const [index, step] of run.workflow_definition.steps.entries()) {
      const stepResult = await db.query(
        `INSERT INTO workflow_run_steps (tenant_id, run_id, retry_cycle, attempt, step_index, step_name, status, input, started_at)
         VALUES ($1,$2,$3,$4,$5,$6,'running',$7,NOW()) RETURNING id`,
        [run.tenant_id, run.id, run.retry_cycle, run.attempts, index, step.name, current],
      );
      try {
        const connectionResult = await db.query(
          `SELECT * FROM connections WHERE id=$1 AND tenant_id=$2 AND status='active'`,
          [step.connectionId, run.tenant_id],
        );
        if (!connectionResult.rows[0]) {
          const error = new Error(`Active connection unavailable for step ${step.name}`);
          error.retryable = false;
          throw error;
        }
        current = await adapter(connectionResult.rows[0], step, current, {
          runId: run.id,
          retryCycle: run.retry_cycle,
          stepIndex: index,
          idempotencyKey: `integrator:${run.id}:${run.retry_cycle}:${index}`,
        });
        await db.query(
          `UPDATE workflow_run_steps SET status='succeeded', output=$1, completed_at=NOW()
            WHERE id=$2 AND tenant_id=$3`,
          [current, stepResult.rows[0].id, run.tenant_id],
        );
      } catch (error) {
        await db.query(
          `UPDATE workflow_run_steps SET status='failed', error=$1, completed_at=NOW()
            WHERE id=$2 AND tenant_id=$3`,
          [{ message: error.message, retryable: error.retryable !== false }, stepResult.rows[0].id, run.tenant_id],
        );
        throw error;
      }
    }
    await markRunSucceeded(run, current);
    return { status: 'succeeded', output: current };
  } catch (error) {
    return { status: await markRunFailed(run, error, run), error };
  }
}

function canCancel(status) {
  return !terminalStatuses.has(status) && status !== 'running';
}

module.exports = {
  canCancel,
  claimNextRun,
  enqueueRun,
  executeClaimedRun,
  requestHash,
  retryDelay,
};
