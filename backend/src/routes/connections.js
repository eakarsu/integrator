const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { HttpError, asyncRoute } = require('../errors');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { appendAudit } = require('../services/audit');
const { encryptCredentials } = require('../services/credentials');
const { assertSafeConnectorUrl } = require('../services/networkPolicy');

const router = express.Router();
const credentialSchema = z.object({
  bearer_token: z.string().min(1).max(8192).optional(),
  api_key: z.string().min(1).max(8192).optional(),
  api_key_header: z.string().regex(/^[A-Za-z0-9-]{1,64}$/).optional(),
}).refine((value) => !value.api_key || value.api_key_header, { message: 'api_key_header is required with api_key' })
  .refine((value) => !(value.bearer_token && value.api_key_header?.toLowerCase() === 'authorization'),
    { message: 'authorization cannot contain both bearer_token and api_key' })
  .refine((value) => !value.api_key_header || !['host', 'content-length', 'connection', 'transfer-encoding']
    .includes(value.api_key_header.toLowerCase()), { message: 'api_key_header is not allowed' }).strict();
const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  connector_type: z.literal('http'),
  base_url: z.url().max(2048),
  credentials: credentialSchema.optional().default({}),
}).strict();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  base_url: z.url().max(2048).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  credentials: credentialSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const idParamSchema = z.object({ id: z.uuid() }).strict();

const publicColumns = `id, tenant_id, name, connector_type, base_url, status,
  (encrypted_credentials IS NOT NULL) AS credentials_configured, created_at, updated_at`;

router.get('/', asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT ${publicColumns} FROM connections WHERE tenant_id=$1 ORDER BY created_at DESC`,
    [req.user.tenantId],
  );
  res.json(result.rows);
}));

router.post('/', requireRole('editor'), validate(createSchema), asyncRoute(async (req, res) => {
  await assertSafeConnectorUrl(req.body.base_url);
  const created = await db.transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO connections (tenant_id,name,connector_type,base_url,encrypted_credentials,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${publicColumns}`,
      [req.user.tenantId, req.body.name, req.body.connector_type, req.body.base_url,
        encryptCredentials(req.body.credentials), req.user.id],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'connection.created',
      resourceType: 'connection',
      resourceId: result.rows[0].id,
      details: { name: req.body.name, connectorType: req.body.connector_type },
    });
    return result.rows[0];
  });
  res.status(201).json(created);
}));

router.patch('/:id', requireRole('editor'), validate(idParamSchema, 'params'), validate(updateSchema), asyncRoute(async (req, res) => {
  if (req.body.base_url) await assertSafeConnectorUrl(req.body.base_url);
  const updated = await db.transaction(async (client) => {
    const currentResult = await client.query(
      'SELECT * FROM connections WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
      [req.params.id, req.user.tenantId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'CONNECTION_NOT_FOUND', 'Connection not found');
    const credentials = Object.hasOwn(req.body, 'credentials')
      ? encryptCredentials(req.body.credentials)
      : current.encrypted_credentials;
    const result = await client.query(
      `UPDATE connections SET name=$1, base_url=$2, status=$3, encrypted_credentials=$4, updated_at=NOW()
        WHERE id=$5 AND tenant_id=$6 RETURNING ${publicColumns}`,
      [req.body.name ?? current.name, req.body.base_url ?? current.base_url,
        req.body.status ?? current.status, credentials, current.id, req.user.tenantId],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'connection.updated',
      resourceType: 'connection',
      resourceId: current.id,
      details: { changedFields: Object.keys(req.body) },
    });
    return result.rows[0];
  });
  res.json(updated);
}));

module.exports = router;
