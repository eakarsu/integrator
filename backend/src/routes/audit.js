const express = require('express');
const db = require('../db');
const { asyncRoute } = require('../errors');
const requireRole = require('../middleware/requireRole');
const { verifyAuditChain } = require('../services/audit');

const router = express.Router();
router.use(requireRole('admin'));

router.get('/', asyncRoute(async (req, res) => {
  const result = await db.query(
    `SELECT sequence, actor_id, action, resource_type, resource_id, details,
            occurred_at, previous_hash, event_hash
       FROM audit_events WHERE tenant_id=$1 ORDER BY sequence DESC LIMIT 250`,
    [req.user.tenantId],
  );
  res.json(result.rows);
}));

router.get('/verify', asyncRoute(async (req, res) => {
  res.json(await verifyAuditChain(db, req.user.tenantId));
}));

module.exports = router;
