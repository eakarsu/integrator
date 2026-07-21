const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  test('API-to-connector workflow (set TEST_DATABASE_URL to run)', { skip: true }, () => {});
} else {
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret-with-at-least-32-characters';
  process.env.CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64');
  process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS = 'true';
  process.env.ALLOW_INSECURE_CONNECTOR_HTTP = 'true';

  const bcrypt = require('bcryptjs');
  const db = require('../src/db');
  const { createApp } = require('../src/app');
  const { claimNextRun, executeClaimedRun } = require('../src/services/workflowEngine');
  const { assertSchemaCurrent } = require('../src/services/schemaState');

  test.after(async () => db.close());

  test('operator journey persists, snapshots, delivers, dead-letters, repairs, retries, and cancels', async (t) => {
    const current = await db.query('SELECT current_database() AS name');
    assert.match(current.rows[0].name, /(test|validation)/i, 'end-to-end tests require a disposable test database');
    await assertSchemaCurrent(db);
    await db.query(`TRUNCATE TABLE audit_events, workflow_run_steps, workflow_runs, workflows,
      connections, users, tenants RESTART IDENTITY CASCADE`);

    const received = [];
    const destination = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
        received.push({ path: req.url, headers: req.headers, body });
        res.setHeader('content-type', 'application/json');
        if (req.url === '/fail') {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: 'temporary outage' }));
        } else {
          res.end(JSON.stringify({ accepted: true, source: body }));
        }
      });
    });
    destination.listen(0, '127.0.0.1');
    await new Promise((resolve) => destination.once('listening', resolve));
    t.after(() => new Promise((resolve) => destination.close(resolve)));
    const destinationUrl = `http://127.0.0.1:${destination.address().port}`;

    const password = 'StrongPassword-42';
    const email = `operator-${crypto.randomUUID()}@example.test`;
    const passwordHash = await bcrypt.hash(password, 4);
    await db.transaction(async (client) => {
      const tenant = await client.query("INSERT INTO tenants(name) VALUES ('Journey tenant') RETURNING id");
      const user = await client.query(
        `INSERT INTO users(tenant_id,name,email,password_hash,role)
         VALUES ($1,'Operator',$2,$3,'admin') RETURNING id`,
        [tenant.rows[0].id, email, passwordHash],
      );
      await client.query('UPDATE users SET created_by=id WHERE id=$1', [user.rows[0].id]);
    });

    const api = createApp().listen(0, '127.0.0.1');
    await new Promise((resolve) => api.once('listening', resolve));
    t.after(() => new Promise((resolve) => api.close(resolve)));
    const apiUrl = `http://127.0.0.1:${api.address().port}/api`;
    const request = (path, options = {}) => fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
    });

    let response = await request('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    const token = (await response.json()).token;
    const authorized = { authorization: `Bearer ${token}` };

    response = await request('/connections', {
      method: 'POST', headers: authorized,
      body: JSON.stringify({
        name: 'Journey destination', connectorType: 'http', baseUrl: destinationUrl,
        credentials: { bearerToken: 'connector-bearer', apiKey: 'connector-api-key', apiKeyHeader: 'X-Connector-Key' },
      }),
    });
    assert.equal(response.status, 201);
    const connection = await response.json();
    assert.equal(connection.credentialsConfigured, true);
    assert.equal(Object.hasOwn(connection, 'encryptedCredentials'), false);

    response = await request('/workflows', {
      method: 'POST', headers: authorized,
      body: JSON.stringify({
        name: 'Journey workflow', maxAttempts: 2, retryDelayMs: 100,
        definition: { steps: [{ name: 'Deliver', connectionId: connection.id, method: 'POST', path: '/deliver' }] },
      }),
    });
    assert.equal(response.status, 201);
    const workflow = await response.json();
    response = await request(`/workflows/${workflow.id}/state`, {
      method: 'POST', headers: authorized, body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(response.status, 200);

    const idempotencyHeaders = { ...authorized, 'Idempotency-Key': 'journey-delivery-1' };
    response = await request(`/workflows/${workflow.id}/runs`, {
      method: 'POST', headers: idempotencyHeaders, body: JSON.stringify({ input: { orderId: 42 } }),
    });
    assert.equal(response.status, 202);
    const run = await response.json();
    assert.equal(run.workflowVersion, 1);
    response = await request(`/workflows/${workflow.id}/runs`, {
      method: 'POST', headers: idempotencyHeaders, body: JSON.stringify({ input: { orderId: 42 } }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).id, run.id);
    response = await request(`/workflows/${workflow.id}/runs`, {
      method: 'POST', headers: idempotencyHeaders, body: JSON.stringify({ input: { orderId: 43 } }),
    });
    assert.equal(response.status, 409);

    response = await request(`/workflows/${workflow.id}/state`, {
      method: 'POST', headers: authorized, body: JSON.stringify({ status: 'paused' }),
    });
    assert.equal(response.status, 200);
    response = await request(`/workflows/${workflow.id}`, {
      method: 'PUT', headers: authorized,
      body: JSON.stringify({
        name: 'Journey workflow', description: 'Failure-path revision', maxAttempts: 1, retryDelayMs: 100,
        definition: { steps: [{ name: 'Deliver', connectionId: connection.id, method: 'POST', path: '/fail' }] },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).version, 2);

    let claimed = await claimNextRun('e2e-worker');
    assert.equal(claimed.id, run.id);
    let outcome = await executeClaimedRun(claimed);
    assert.equal(outcome.status, 'succeeded');
    assert.equal(received[0].path, '/deliver', 'queued run must use its version-one snapshot');
    assert.equal(received[0].headers.authorization, 'Bearer connector-bearer');
    assert.equal(received[0].headers['x-connector-key'], 'connector-api-key');
    assert.equal(received[0].headers['idempotency-key'], `integrator:${run.id}:0:0`);
    assert.deepEqual(received[0].body, { orderId: 42 });

    response = await request(`/workflows/${workflow.id}/state`, {
      method: 'POST', headers: authorized, body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(response.status, 200);
    response = await request(`/workflows/${workflow.id}/runs`, {
      method: 'POST', headers: { ...authorized, 'Idempotency-Key': 'journey-failure-1' },
      body: JSON.stringify({ input: { orderId: 84 } }),
    });
    assert.equal(response.status, 202);
    const failedRun = await response.json();
    claimed = await claimNextRun('e2e-worker');
    outcome = await executeClaimedRun(claimed);
    assert.equal(outcome.status, 'dead_letter');

    response = await request(`/workflows/${workflow.id}/state`, {
      method: 'POST', headers: authorized, body: JSON.stringify({ status: 'paused' }),
    });
    assert.equal(response.status, 200);
    response = await request(`/workflows/${workflow.id}`, {
      method: 'PUT', headers: authorized,
      body: JSON.stringify({
        name: 'Journey workflow', description: 'Recovered revision', maxAttempts: 2, retryDelayMs: 100,
        definition: { steps: [{ name: 'Deliver', connectionId: connection.id, method: 'POST', path: '/recovered' }] },
      }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).version, 3);
    response = await request(`/workflows/${workflow.id}/state`, {
      method: 'POST', headers: authorized, body: JSON.stringify({ status: 'active' }),
    });
    assert.equal(response.status, 200);
    response = await request(`/workflows/runs/${failedRun.id}/retry`, { method: 'POST', headers: authorized });
    assert.equal(response.status, 202);
    const retried = await response.json();
    assert.equal(retried.workflowVersion, 3);
    assert.equal(retried.retryCycle, 1);
    claimed = await claimNextRun('e2e-worker');
    outcome = await executeClaimedRun(claimed);
    assert.equal(outcome.status, 'succeeded');
    assert.equal(received.at(-1).path, '/recovered');
    assert.equal(received.at(-1).headers['idempotency-key'], `integrator:${failedRun.id}:1:0`);

    response = await request(`/workflows/${workflow.id}/runs`, {
      method: 'POST', headers: { ...authorized, 'Idempotency-Key': 'journey-cancel-1' },
      body: JSON.stringify({ input: { orderId: 126 } }),
    });
    assert.equal(response.status, 202);
    const cancellable = await response.json();
    response = await request(`/workflows/runs/${cancellable.id}/cancel`, { method: 'POST', headers: authorized });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'cancelled');

    response = await request(`/workflows/runs/${run.id}`, { headers: authorized });
    const stored = await response.json();
    assert.equal(stored.status, 'succeeded');
    assert.equal(stored.workflowVersion, 1);
    response = await request('/audit/verify', { headers: authorized });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).valid, true);
    response = await request('/health/ready');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).schema.expected, 2);
  });
}
