const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { HttpError, asyncRoute } = require('../errors');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { appendAudit } = require('../services/audit');
const { canCancel, enqueueRun } = require('../services/workflowEngine');

const router = express.Router();
const idSchema = z.uuid();
const stepSchema = z.object({
  name: z.string().trim().min(1).max(120),
  connection_id: z.uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  path: z.string().startsWith('/').max(1024).default('/'),
}).strict();
const definitionSchema = z.object({ steps: z.array(stepSchema).min(1).max(50) }).strict();
const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().default(''),
  definition: definitionSchema,
  max_attempts: z.number().int().min(1).max(10).default(3),
  retry_delay_ms: z.number().int().min(100).max(3600000).default(1000),
}).strict();
const runSchema = z.object({ input: z.json().optional().default({}) }).strict();

function parseId(value) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'INVALID_ID', 'Resource ID must be a UUID');
  return parsed.data;
}

function normalizeDefinition(definition) {
  return {
    steps: definition.steps.map((step) => ({
      name: step.name,
      connectionId: step.connection_id,
      method: step.method,
      path: step.path,
    })),
  };
}

async function assertOwnedConnections(client, tenantId, definition) {
  const connectionIds = [...new Set(definition.steps.map((step) => step.connectionId))];
  const result = await client.query(
    `SELECT id FROM connections WHERE tenant_id=$1 AND status='active' AND id = ANY($2::uuid[])`,
    [tenantId, connectionIds],
  );
  if (result.rows.length !== connectionIds.length) {
    throw new HttpError(400, 'INVALID_WORKFLOW_CONNECTION', 'Every workflow step must use an active connection owned by the tenant');
  }
}

router.get('/', asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT id, name, description, version, status, definition, max_attempts, retry_delay_ms,
            created_by, created_at, updated_at
       FROM workflows WHERE tenant_id=$1 ORDER BY updated_at DESC`,
    [req.user.tenantId],
  );
  res.json(result.rows);
}));

router.post('/', requireRole('editor'), validate(createSchema), asyncRoute(async (req, res) => {
  const definition = normalizeDefinition(req.body.definition);
  const workflow = await db.transaction(async (client) => {
    await assertOwnedConnections(client, req.user.tenantId, definition);
    const result = await client.query(
      `INSERT INTO workflows
         (tenant_id,name,description,definition,max_attempts,retry_delay_ms,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.tenantId, req.body.name, req.body.description, definition,
        req.body.max_attempts, req.body.retry_delay_ms, req.user.id],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'workflow.created',
      resourceType: 'workflow',
      resourceId: result.rows[0].id,
      details: { version: 1, stepCount: definition.steps.length },
    });
    return result.rows[0];
  });
  res.status(201).json(workflow);
}));

router.put('/:id', requireRole('editor'), validate(createSchema), asyncRoute(async (req, res) => {
  const workflowId = parseId(req.params.id);
  const definition = normalizeDefinition(req.body.definition);
  const workflow = await db.transaction(async (client) => {
    const currentResult = await client.query(
      'SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
      [workflowId, req.user.tenantId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
    if (current.status !== 'draft' && current.status !== 'paused') {
      throw new HttpError(409, 'WORKFLOW_LOCKED', 'Pause the workflow before editing it');
    }
    await assertOwnedConnections(client, req.user.tenantId, definition);
    const result = await client.query(
      `UPDATE workflows SET name=$1, description=$2, definition=$3, max_attempts=$4,
          retry_delay_ms=$5, version=version+1, updated_at=NOW()
        WHERE id=$6 AND tenant_id=$7 RETURNING *`,
      [req.body.name, req.body.description, definition, req.body.max_attempts,
        req.body.retry_delay_ms, workflowId, req.user.tenantId],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'workflow.updated',
      resourceType: 'workflow',
      resourceId: workflowId,
      details: { version: result.rows[0].version, stepCount: definition.steps.length },
    });
    return result.rows[0];
  });
  res.json(workflow);
}));

router.post('/:id/state', requireRole('editor'), validate(z.object({ status: z.enum(['active', 'paused', 'archived']) }).strict()), asyncRoute(async (req, res) => {
  const workflowId = parseId(req.params.id);
  const allowed = {
    draft: new Set(['active', 'archived']),
    active: new Set(['paused']),
    paused: new Set(['active', 'archived']),
    archived: new Set(),
  };
  const workflow = await db.transaction(async (client) => {
    const currentResult = await client.query(
      'SELECT * FROM workflows WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
      [workflowId, req.user.tenantId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
    if (!allowed[current.status].has(req.body.status)) {
      throw new HttpError(409, 'INVALID_WORKFLOW_TRANSITION', `Cannot move workflow from ${current.status} to ${req.body.status}`);
    }
    if (req.body.status === 'active') await assertOwnedConnections(client, req.user.tenantId, current.definition);
    const result = await client.query(
      'UPDATE workflows SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [req.body.status, workflowId, req.user.tenantId],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'workflow.state_changed',
      resourceType: 'workflow',
      resourceId: workflowId,
      details: { from: current.status, to: req.body.status },
    });
    return result.rows[0];
  });
  res.json(workflow);
}));

router.post('/:id/runs', requireRole('editor'), validate(runSchema), asyncRoute(async (req, res) => {
  const workflowId = parseId(req.params.id);
  const idempotencyKey = req.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length > 200) {
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required');
  }
  const result = await enqueueRun({
    tenantId: req.user.tenantId,
    actorId: req.user.id,
    workflowId,
    idempotencyKey,
    input: req.body.input,
  });
  res.status(result.replayed ? 200 : 202).json({ ...result.run, replayed: result.replayed });
}));

router.get('/:id/runs', asyncRoute(async (req, res) => {
  const workflowId = parseId(req.params.id);
  const result = await db.query(
    `SELECT id, workflow_id, workflow_version, status, input, output, error, attempts, retry_cycle, next_attempt_at,
            started_at, completed_at, created_at, updated_at
       FROM workflow_runs WHERE workflow_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,
    [workflowId, req.user.tenantId],
  );
  res.json(result.rows);
}));

router.get('/runs/:runId', asyncRoute(async (req, res) => {
  const runId = parseId(req.params.runId);
  const result = await db.query(
    `SELECT run.*, COALESCE(json_agg(step ORDER BY step.step_index)
       FILTER (WHERE step.id IS NOT NULL), '[]') AS steps
       FROM workflow_runs run LEFT JOIN workflow_run_steps step
         ON step.run_id=run.id AND step.tenant_id=run.tenant_id
      WHERE run.id=$1 AND run.tenant_id=$2 GROUP BY run.id`,
    [runId, req.user.tenantId],
  );
  if (!result.rows[0]) throw new HttpError(404, 'RUN_NOT_FOUND', 'Workflow run not found');
  res.json(result.rows[0]);
}));

router.post('/runs/:runId/cancel', requireRole('editor'), asyncRoute(async (req, res) => {
  const runId = parseId(req.params.runId);
  const run = await db.transaction(async (client) => {
    const currentResult = await client.query(
      'SELECT * FROM workflow_runs WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
      [runId, req.user.tenantId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'RUN_NOT_FOUND', 'Workflow run not found');
    if (!canCancel(current.status)) throw new HttpError(409, 'RUN_NOT_CANCELLABLE', `Run in ${current.status} cannot be cancelled`);
    const result = await client.query(
      `UPDATE workflow_runs SET status='cancelled', completed_at=NOW(), next_attempt_at=NULL, updated_at=NOW()
        WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [runId, req.user.tenantId],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'workflow_run.cancelled',
      resourceType: 'workflow_run',
      resourceId: runId,
      details: { previousStatus: current.status },
    });
    return result.rows[0];
  });
  res.json(run);
}));

router.post('/runs/:runId/retry', requireRole('editor'), asyncRoute(async (req, res) => {
  const runId = parseId(req.params.runId);
  const run = await db.transaction(async (client) => {
    const currentResult = await client.query(
      `SELECT run.*, workflow.status AS workflow_status, workflow.version AS current_workflow_version,
              workflow.definition AS current_workflow_definition,
              workflow.max_attempts AS current_max_attempts,
              workflow.retry_delay_ms AS current_retry_delay_ms
         FROM workflow_runs run JOIN workflows workflow
           ON workflow.id=run.workflow_id AND workflow.tenant_id=run.tenant_id
        WHERE run.id=$1 AND run.tenant_id=$2 FOR UPDATE OF run`,
      [runId, req.user.tenantId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'RUN_NOT_FOUND', 'Workflow run not found');
    if (current.status !== 'dead_letter' || current.workflow_status !== 'active') {
      throw new HttpError(409, 'RUN_NOT_RETRYABLE', 'Only dead-letter runs for active workflows can be retried');
    }
    const result = await client.query(
      `UPDATE workflow_runs SET status='queued', attempts=0, retry_cycle=retry_cycle+1, error=NULL, output=NULL,
          workflow_version=$1, workflow_definition=$2, max_attempts=$3, retry_delay_ms=$4,
          completed_at=NULL, next_attempt_at=NOW(), updated_at=NOW()
        WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [current.current_workflow_version, current.current_workflow_definition,
        current.current_max_attempts, current.current_retry_delay_ms, runId, req.user.tenantId],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'workflow_run.requeued',
      resourceType: 'workflow_run',
      resourceId: runId,
      details: { fromVersion: current.workflow_version, toVersion: current.current_workflow_version },
    });
    return result.rows[0];
  });
  res.status(202).json(run);
}));

module.exports = router;
