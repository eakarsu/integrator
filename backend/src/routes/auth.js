const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../db');
const { getConfig } = require('../config');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { asyncRoute } = require('../errors');
const { appendAudit } = require('../services/audit');

const router = express.Router();
const loginSchema = z.object({
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict();
const dummyPasswordHash = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.8Glz5RyY.3/8U.OqWqKc1vCvkf6XwO.';

function tokenFor(user) {
  return jwt.sign(
    { tenantId: user.tenant_id, role: user.role, authVersion: user.auth_version },
    getConfig().jwtSecret,
    { algorithm: 'HS256', subject: String(user.id), issuer: 'integrator-api', audience: 'integrator-ui', expiresIn: '1h' },
  );
}

router.post('/login', validate(loginSchema), asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT users.id, users.tenant_id, users.name, users.email, users.password_hash,
            users.role, users.status, users.auth_version
       FROM users JOIN tenants ON tenants.id=users.tenant_id
      WHERE users.email = $1 AND tenants.status='active'`,
    [req.body.email],
  );
  const user = result.rows[0];
  const valid = await bcrypt.compare(req.body.password, user?.password_hash || dummyPasswordHash);
  if (!user || !valid || user.status !== 'active') {
    return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  }
  await db.transaction(async (client) => {
    await client.query('UPDATE users SET last_login=NOW() WHERE id=$1 AND tenant_id=$2', [user.id, user.tenant_id]);
    await appendAudit(client, {
      tenantId: user.tenant_id,
      actorId: user.id,
      action: 'session.created',
      resourceType: 'user',
      resourceId: user.id,
      details: {},
    });
  });
  res.json({
    token: tokenFor(user),
    expiresIn: 3600,
    user: { id: user.id, tenantId: user.tenant_id, name: user.name, email: user.email, role: user.role },
  });
}));

router.get('/me', auth, (req, res) => res.json({ user: req.user }));

router.post('/logout-all', auth, asyncRoute(async (req, res) => {
  await db.transaction(async (client) => {
    await client.query(
      'UPDATE users SET auth_version=auth_version+1, updated_at=NOW() WHERE id=$1 AND tenant_id=$2',
      [req.user.id, req.user.tenantId],
    );
    await appendAudit(client, {
      tenantId: req.user.tenantId,
      actorId: req.user.id,
      action: 'session.revoked_all',
      resourceType: 'user',
      resourceId: req.user.id,
      details: {},
    });
  });
  res.status(204).end();
}));

module.exports = router;
