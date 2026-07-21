const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  test('integration workflow (set TEST_DATABASE_URL to run)', { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret-at-least-32-characters';
  process.env.CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64');
  process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS = 'true';
  process.env.ALLOW_INSECURE_CONNECTOR_HTTP = 'true';

  const db = require('../src/db');
  const bcrypt = require('bcryptjs');
  const { appendAudit, verifyAuditChain } = require('../src/services/audit');
  const { claimNextRun, enqueueRun, executeClaimedRun } = require('../src/services/workflowEngine');
  const { createApp } = require('../src/app');
  let tenantFixture;

  test.before(async () => {
    const current = await db.query('SELECT current_database() AS name');
    assert.match(current.rows[0].name, /(test|validation)/i, 'integration tests require a disposable test database');
    await db.query(`TRUNCATE TABLE audit_events, workflow_run_steps, workflow_runs, workflows,
      connections, users, tenants RESTART IDENTITY CASCADE`);
  });

  test.after(async () => db.close());

  test('tenant-safe idempotent workflow succeeds and writes immutable evidence', async () => {
    const password = 'StrongPassword-42';
    const passwordHash = await bcrypt.hash(password, 4);
    const adminEmail = `admin-${crypto.randomUUID()}@example.test`;
    const viewerEmail = `viewer-${crypto.randomUUID()}@example.test`;
    const fixture = await db.transaction(async (client) => {
      const tenant = await client.query("INSERT INTO tenants(name) VALUES ('Acme') RETURNING id");
      const otherTenant = await client.query("INSERT INTO tenants(name) VALUES ('Other') RETURNING id");
      const user = await client.query(
        `INSERT INTO users(tenant_id,name,email,password_hash,role)
         VALUES ($1,'Admin',$2,'unused','admin') RETURNING id`,
        [tenant.rows[0].id, adminEmail],
      );
      const otherUser = await client.query(
        `INSERT INTO users(tenant_id,name,email,password_hash,role)
         VALUES ($1,'Other Admin',$2,'unused','admin') RETURNING id`,
        [otherTenant.rows[0].id, `other-${crypto.randomUUID()}@example.test`],
      );
      await client.query('UPDATE users SET created_by=id WHERE id IN ($1,$2)', [user.rows[0].id, otherUser.rows[0].id]);
      await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, user.rows[0].id]);
      const viewer = await client.query(
        `INSERT INTO users(tenant_id,name,email,password_hash,role)
         VALUES ($1,'Viewer',$2,$3,'viewer') RETURNING id`,
        [tenant.rows[0].id, viewerEmail, passwordHash],
      );
      await client.query('UPDATE users SET created_by=id WHERE id=$1', [viewer.rows[0].id]);
      const connection = await client.query(
        `INSERT INTO connections(tenant_id,name,connector_type,base_url,created_by)
         VALUES ($1,'Destination','http','http://127.0.0.1:9999',$2) RETURNING id`,
        [tenant.rows[0].id, user.rows[0].id],
      );
      const workflow = await client.query(
        `INSERT INTO workflows(tenant_id,name,status,definition,max_attempts,retry_delay_ms,created_by)
         VALUES ($1,'Delivery','active',$2,2,100,$3) RETURNING id`,
        [tenant.rows[0].id, { steps: [{ name: 'Send', connectionId: connection.rows[0].id, method: 'POST', path: '/events' }] }, user.rows[0].id],
      );
      await appendAudit(client, {
        tenantId: tenant.rows[0].id,
        actorId: user.rows[0].id,
        action: 'fixture.created',
        resourceType: 'workflow',
        resourceId: workflow.rows[0].id,
      });
      return {
        tenantId: tenant.rows[0].id,
        otherTenantId: otherTenant.rows[0].id,
        userId: user.rows[0].id,
        workflowId: workflow.rows[0].id,
        adminEmail,
        viewerEmail,
        password,
        viewerId: viewer.rows[0].id,
      };
    });
    tenantFixture = fixture;

    const first = await enqueueRun({
      tenantId: fixture.tenantId,
      actorId: fixture.userId,
      workflowId: fixture.workflowId,
      idempotencyKey: 'order-42',
      input: { orderId: 42 },
    });
    assert.equal(first.replayed, false);
    const replay = await enqueueRun({
      tenantId: fixture.tenantId,
      actorId: fixture.userId,
      workflowId: fixture.workflowId,
      idempotencyKey: 'order-42',
      input: { orderId: 42 },
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.run.id, first.run.id);
    await assert.rejects(
      enqueueRun({ tenantId: fixture.tenantId, actorId: fixture.userId, workflowId: fixture.workflowId, idempotencyKey: 'order-42', input: { orderId: 43 } }),
      (error) => error.code === 'IDEMPOTENCY_CONFLICT',
    );
    await assert.rejects(
      enqueueRun({ tenantId: fixture.otherTenantId, actorId: fixture.userId, workflowId: fixture.workflowId, idempotencyKey: 'cross-tenant', input: {} }),
      (error) => error.code === 'WORKFLOW_NOT_FOUND',
    );

    const claims = await Promise.all([claimNextRun('worker-a'), claimNextRun('worker-b')]);
    assert.equal(claims.filter(Boolean).length, 1);
    const result = await executeClaimedRun(claims.find(Boolean), async (_connection, step, input) => ({ ...input, deliveredBy: step.name }));
    assert.deepEqual(result, { status: 'succeeded', output: { orderId: 42, deliveredBy: 'Send' } });
    const stored = await db.query('SELECT status, attempts, output FROM workflow_runs WHERE id=$1', [first.run.id]);
    assert.equal(stored.rows[0].status, 'succeeded');
    assert.equal(stored.rows[0].attempts, 1);
    assert.deepEqual(stored.rows[0].output, { orderId: 42, deliveredBy: 'Send' });

    const duplicateInputs = {
      tenantId: fixture.tenantId,
      actorId: fixture.userId,
      workflowId: fixture.workflowId,
      idempotencyKey: 'concurrent-duplicate',
      input: { eventId: 'same' },
    };
    const concurrentDuplicates = await Promise.all([enqueueRun(duplicateInputs), enqueueRun(duplicateInputs)]);
    assert.equal(concurrentDuplicates[0].run.id, concurrentDuplicates[1].run.id);
    const duplicateClaim = await claimNextRun('worker-duplicate');
    await executeClaimedRun(duplicateClaim, async (_connection, _step, input) => input);

    const leaseRun = await enqueueRun({
      ...duplicateInputs,
      idempotencyKey: 'expired-lease',
      input: { eventId: 'lease' },
    });
    const staleClaim = await claimNextRun('stale-worker', -1);
    const replacementClaim = await claimNextRun('replacement-worker');
    assert.equal(staleClaim.id, leaseRun.run.id);
    assert.equal(replacementClaim.id, leaseRun.run.id);
    await assert.rejects(
      executeClaimedRun(staleClaim, async (_connection, _step, input) => input),
      /lease was lost/,
    );
    await executeClaimedRun(replacementClaim, async (_connection, _step, input) => input);

    const audit = await verifyAuditChain(db, fixture.tenantId);
    assert.equal(audit.valid, true);
    assert.ok(audit.checked >= 3);
    await assert.rejects(db.query('UPDATE audit_events SET action=$1 WHERE tenant_id=$2', ['tampered', fixture.tenantId]), /immutable/);
  });

  test('HTTP boundary enforces login, validation, tenant scoping, roles, and session revocation', async () => {
    const server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });
    try {
      let response = await request('/auth/register', { method: 'POST', body: '{}' });
      assert.equal(response.status, 404);
      response = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'missing-user@example.test', password: tenantFixture.password }),
      });
      assert.equal(response.status, 401);
      response = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: tenantFixture.adminEmail, password: tenantFixture.password }),
      });
      assert.equal(response.status, 200);
      const adminToken = (await response.json()).token;

      response = await request('/connections', { headers: { authorization: `Bearer ${adminToken}` } });
      assert.equal(response.status, 200);
      const connections = await response.json();
      assert.equal(connections.length, 1);
      assert.equal(Object.hasOwn(connections[0], 'encryptedCredentials'), false);

      response = await request('/connections', {
        method: 'POST',
        headers: { authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ name: '' }),
      });
      assert.equal(response.status, 400);

      response = await request('/workflows/not-a-uuid/runs', {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      assert.equal(response.status, 400);

      response = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: tenantFixture.viewerEmail, password: tenantFixture.password }),
      });
      const viewerToken = (await response.json()).token;
      response = await request('/connections', {
        method: 'POST',
        headers: { authorization: `Bearer ${viewerToken}` },
        body: JSON.stringify({ name: 'Forbidden', connectorType: 'http', baseUrl: 'http://127.0.0.1:9999' }),
      });
      assert.equal(response.status, 403);

      response = await request('/auth/logout-all', {
        method: 'POST',
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      assert.equal(response.status, 204);
      response = await request('/connections', { headers: { authorization: `Bearer ${viewerToken}` } });
      assert.equal(response.status, 401);

      await db.query("UPDATE tenants SET status='suspended' WHERE id=$1", [tenantFixture.tenantId]);
      response = await request('/connections', { headers: { authorization: `Bearer ${adminToken}` } });
      assert.equal(response.status, 401);
      await db.query("UPDATE tenants SET status='active' WHERE id=$1", [tenantFixture.tenantId]);

      response = await request('/audit/verify', { headers: { authorization: `Bearer ${adminToken}` } });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).valid, true);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  test('retryable failures are scheduled and become dead letters at the attempt limit', async () => {
    const source = await db.query(
      `SELECT tenant_id, workflow_id, requested_by FROM workflow_runs WHERE status='succeeded' ORDER BY created_at DESC LIMIT 1`,
    );
    const row = source.rows[0];
    const queued = await enqueueRun({
      tenantId: row.tenant_id,
      actorId: row.requested_by,
      workflowId: row.workflow_id,
      idempotencyKey: 'failure-case',
      input: { shouldFail: true },
    });
    let claimed = await claimNextRun('worker-failure');
    const failingAdapter = async () => {
      const error = new Error('Temporary connector outage');
      error.retryable = true;
      throw error;
    };
    let outcome = await executeClaimedRun(claimed, failingAdapter);
    assert.equal(outcome.status, 'retry_scheduled');
    await db.query('UPDATE workflow_runs SET next_attempt_at=NOW() WHERE id=$1', [queued.run.id]);
    claimed = await claimNextRun('worker-failure');
    outcome = await executeClaimedRun(claimed, failingAdapter);
    assert.equal(outcome.status, 'dead_letter');
    const stored = await db.query('SELECT status, attempts, error FROM workflow_runs WHERE id=$1', [queued.run.id]);
    assert.equal(stored.rows[0].status, 'dead_letter');
    assert.equal(stored.rows[0].attempts, 2);
    assert.equal(stored.rows[0].error.retryable, true);

    const server = createApp().listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      const login = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: tenantFixture.adminEmail, password: tenantFixture.password }),
      });
      const token = (await login.json()).token;
      const retried = await fetch(`${baseUrl}/workflows/runs/${queued.run.id}/retry`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(retried.status, 202);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    claimed = await claimNextRun('worker-recovery');
    outcome = await executeClaimedRun(claimed, async (_connection, _step, input) => ({ ...input, recovered: true }));
    assert.equal(outcome.status, 'succeeded');
    const recovered = await db.query('SELECT status, retry_cycle, attempts FROM workflow_runs WHERE id=$1', [queued.run.id]);
    assert.deepEqual(recovered.rows[0], { status: 'succeeded', retry_cycle: 1, attempts: 1 });
    const audit = await verifyAuditChain(db, row.tenant_id);
    assert.equal(audit.valid, true);
  });
}
