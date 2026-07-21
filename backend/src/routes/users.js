const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { HttpError, asyncRoute } = require('../errors');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { appendAudit } = require('../services/audit');

const router = express.Router();
const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  role: z.enum(['admin', 'editor', 'viewer']),
}).strict();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  password: z.string().min(12).max(128).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
const idParamSchema = z.object({ id: z.string().regex(/^[1-9]\d{0,18}$/) }).strict();

router.use(requireRole('admin'));

router.get('/', asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT id, name, email, role, status, last_login, created_at, updated_at
       FROM users WHERE tenant_id=$1 ORDER BY created_at`,
    [req.user.tenantId],
  );
  res.json(result.rows);
}));

router.post('/', validate(createSchema), asyncRoute(async (req, res) => {
  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await db.transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO users (tenant_id,name,email,password_hash,role,created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, email, role, status, created_at, updated_at`,
      [req.user.tenantId, req.body.name, req.body.email, passwordHash, req.body.role, req.user.id],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'user.created',
      resourceType: 'user',
      resourceId: result.rows[0].id,
      details: { role: req.body.role },
    });
    return result.rows[0];
  });
  res.status(201).json(user);
}));

router.patch('/:id', validate(idParamSchema, 'params'), validate(updateSchema), asyncRoute(async (req, res) => {
  if (String(req.params.id) === String(req.user.id) && req.body.status === 'disabled') {
    throw new HttpError(409, 'CANNOT_DISABLE_SELF', 'Administrators cannot disable their own account');
  }
  const user = await db.transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`tenant-admins:${req.user.tenantId}`]);
    const currentResult = await client.query(
      'SELECT * FROM users WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
      [req.params.id, req.user.tenantId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    const removesActiveAdmin = current.role === 'admin' && current.status === 'active' &&
      ((req.body.role && req.body.role !== 'admin') || req.body.status === 'disabled');
    if (removesActiveAdmin) {
      const admins = await client.query(
        `SELECT COUNT(*)::integer AS count FROM users
          WHERE tenant_id=$1 AND role='admin' AND status='active'`,
        [req.user.tenantId],
      );
      if (admins.rows[0].count <= 1) {
        throw new HttpError(409, 'LAST_ADMIN_REQUIRED', 'At least one active administrator is required');
      }
    }
    const passwordHash = req.body.password ? await bcrypt.hash(req.body.password, 12) : current.password_hash;
    const revokesSession = req.body.password || (req.body.status && req.body.status !== current.status) ||
      (req.body.role && req.body.role !== current.role);
    const result = await client.query(
      `UPDATE users SET name=$1, role=$2, status=$3, password_hash=$4,
          auth_version=auth_version+$5, updated_at=NOW()
        WHERE id=$6 AND tenant_id=$7
        RETURNING id, name, email, role, status, created_at, updated_at`,
      [req.body.name ?? current.name, req.body.role ?? current.role, req.body.status ?? current.status,
        passwordHash, revokesSession ? 1 : 0, current.id, req.user.tenantId],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'user.updated',
      resourceType: 'user',
      resourceId: current.id,
      details: { changedFields: Object.keys(req.body), sessionsRevoked: Boolean(revokesSession) },
    });
    return result.rows[0];
  });
  res.json(user);
}));

module.exports = router;
