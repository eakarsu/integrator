// Pre-built connector library and SDK for custom connectors.
const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Curated set of connectors. Each declares auth type + base capabilities.
const LIBRARY = [
  { id: 'salesforce', name: 'Salesforce', auth: 'oauth2', actions: ['query', 'upsert', 'subscribe'] },
  { id: 'hubspot', name: 'HubSpot', auth: 'api_key', actions: ['list_contacts', 'create_deal'] },
  { id: 'stripe', name: 'Stripe', auth: 'api_key', actions: ['list_charges', 'refund'] },
  { id: 'netsuite', name: 'NetSuite', auth: 'oauth1', actions: ['list_customers', 'create_invoice'] },
  { id: 'slack', name: 'Slack', auth: 'webhook', actions: ['post_message'] },
  { id: 'shopify', name: 'Shopify', auth: 'api_key', actions: ['list_orders', 'create_product'] }
];

// In-memory custom connectors written via the SDK.
const custom = [];

router.get('/', authMiddleware, (_req, res) => {
  res.json({ builtIn: LIBRARY, custom });
});

router.get('/:id', authMiddleware, (req, res) => {
  const c = LIBRARY.find(x => x.id === req.params.id) || custom.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'connector not found' });
  res.json(c);
});

// POST /api/connector-library/sdk/register — register a custom connector definition.
router.post('/sdk/register', authMiddleware, (req, res) => {
  const { id, name, auth, actions } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  if (LIBRARY.find(x => x.id === id) || custom.find(x => x.id === id)) {
    return res.status(409).json({ error: 'id already used' });
  }
  const conn = { id, name, auth: auth || 'api_key', actions: actions || [], custom: true, createdAt: new Date() };
  custom.push(conn);
  res.json(conn);
});

// POST /api/connector-library/sdk/invoke — invoke a custom action handler URL.
router.post('/sdk/invoke', authMiddleware, async (req, res) => {
  const { id, action, params, handlerUrl } = req.body;
  if (!handlerUrl) return res.status(400).json({ error: 'handlerUrl required' });
  try {
    const r = await fetch(handlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, params: params || {} })
    });
    res.json({ status: r.status, body: await r.json().catch(() => r.text()) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
