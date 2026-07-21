const crypto = require('node:crypto');

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

async function appendAudit(client, event) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [event.tenantId]);
  const previous = await client.query(
    'SELECT sequence, event_hash FROM audit_events WHERE tenant_id = $1 ORDER BY sequence DESC LIMIT 1',
    [event.tenantId],
  );
  const sequence = Number(previous.rows[0]?.sequence || 0) + 1;
  const previousHash = previous.rows[0]?.event_hash || 'GENESIS';
  const occurredAt = new Date().toISOString();
  const payload = {
    tenantId: event.tenantId,
    sequence,
    actorId: event.actorId || null,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: String(event.resourceId),
    details: event.details || {},
    occurredAt,
    previousHash,
  };
  const eventHash = crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');

  const inserted = await client.query(
    `INSERT INTO audit_events
       (tenant_id, sequence, actor_id, action, resource_type, resource_id, details, occurred_at, previous_hash, event_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [event.tenantId, sequence, event.actorId || null, event.action, event.resourceType,
      String(event.resourceId), event.details || {}, occurredAt, previousHash, eventHash],
  );
  return inserted.rows[0];
}

async function verifyAuditChain(client, tenantId) {
  const { rows } = await client.query(
    'SELECT * FROM audit_events WHERE tenant_id = $1 ORDER BY sequence ASC',
    [tenantId],
  );
  let previousHash = 'GENESIS';
  let expectedSequence = 1;
  for (const row of rows) {
    const payload = {
      tenantId: row.tenant_id,
      sequence: Number(row.sequence),
      actorId: row.actor_id ? String(row.actor_id) : null,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      details: row.details,
      occurredAt: new Date(row.occurred_at).toISOString(),
      previousHash,
    };
    const hash = crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
    if (Number(row.sequence) !== expectedSequence || row.previous_hash !== previousHash || row.event_hash !== hash) {
      return { valid: false, checked: expectedSequence - 1, failedSequence: Number(row.sequence) };
    }
    previousHash = row.event_hash;
    expectedSequence += 1;
  }
  return { valid: true, checked: rows.length, head: previousHash };
}

module.exports = { appendAudit, canonicalJson, verifyAuditChain };
