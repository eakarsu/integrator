const jwt = require('jsonwebtoken');
const db = require('../db');
const { getConfig } = require('../config');

module.exports = async function authMiddleware(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error: 'Bearer token required', code: 'AUTH_REQUIRED' });

  let decoded;
  try {
    decoded = jwt.verify(match[1], getConfig().jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'integrator-api',
      audience: 'integrator-ui',
    });
  } catch (_error) {
    return res.status(401).json({ error: 'Token invalid or expired', code: 'TOKEN_INVALID' });
  }

  try {
    const result = await db.query(
      `SELECT users.id, users.tenant_id, users.email, users.name, users.role,
              users.status, users.auth_version
         FROM users JOIN tenants ON tenants.id=users.tenant_id
        WHERE users.id = $1 AND users.tenant_id = $2 AND tenants.status='active'`,
      [decoded.sub, decoded.tenantId],
    );
    const user = result.rows[0];
    if (!user || user.status !== 'active' || user.auth_version !== decoded.authVersion) {
      return res.status(401).json({ error: 'Session is no longer valid', code: 'SESSION_REVOKED' });
    }
    req.user = {
      id: String(user.id),
      tenantId: user.tenant_id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    next();
  } catch (error) {
    next(error);
  }
};
