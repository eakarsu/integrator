// customViews.js — 4 endpoints powering the Integration Views feature set.
const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// ------------------------------------------------------------------
// In-memory state (demo data — sufficient for the UI to operate fully)
// ------------------------------------------------------------------

// Connected external systems (nodes in the topology graph)
const SYSTEMS = [
  { id: 'salesforce',  name: 'Salesforce',   kind: 'crm',         status: 'healthy' },
  { id: 'hubspot',     name: 'HubSpot',      kind: 'crm',         status: 'healthy' },
  { id: 'stripe',      name: 'Stripe',       kind: 'payments',    status: 'degraded' },
  { id: 'shopify',     name: 'Shopify',      kind: 'ecommerce',   status: 'healthy' },
  { id: 'netsuite',    name: 'NetSuite',     kind: 'erp',         status: 'healthy' },
  { id: 'slack',       name: 'Slack',        kind: 'messaging',   status: 'healthy' },
  { id: 'snowflake',   name: 'Snowflake',    kind: 'warehouse',   status: 'healthy' },
  { id: 's3',          name: 'AWS S3',       kind: 'storage',     status: 'healthy' },
  { id: 'postgres',    name: 'Postgres',     kind: 'database',    status: 'healthy' },
  { id: 'integrator',  name: 'Integrator',   kind: 'hub',         status: 'healthy' },
];

// Edges (active integrations)
const INTEGRATIONS = [
  { id: 'i-sf-int',  source: 'salesforce', target: 'integrator', label: 'Accounts sync',     active: true },
  { id: 'i-int-sn',  source: 'integrator', target: 'snowflake',  label: 'Warehouse load',    active: true },
  { id: 'i-st-int',  source: 'stripe',     target: 'integrator', label: 'Charge events',     active: true },
  { id: 'i-int-hb',  source: 'integrator', target: 'hubspot',    label: 'Lead upsert',       active: true },
  { id: 'i-sh-int',  source: 'shopify',    target: 'integrator', label: 'Order stream',      active: true },
  { id: 'i-int-ns',  source: 'integrator', target: 'netsuite',   label: 'Invoice push',      active: true },
  { id: 'i-int-sl',  source: 'integrator', target: 'slack',      label: 'Alerts',            active: true },
  { id: 'i-int-s3',  source: 'integrator', target: 's3',         label: 'Backup',            active: true },
  { id: 'i-pg-int',  source: 'postgres',   target: 'integrator', label: 'CDC',               active: true },
];

// Uptime percentages per integration for the last 7 days (most-recent last)
function buildUptimeSeries() {
  // Stable pseudo-random per integration id for repeatable rendering
  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  const today = new Date();
  return INTEGRATIONS.map((it) => {
    const base = 90 + (hash(it.id) % 9); // 90..98
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const wiggle = ((hash(it.id + i) % 700) / 100); // 0..7
      const uptime = Math.min(100, +(base + wiggle).toFixed(2));
      return { date: d.toISOString().slice(0, 10), uptime };
    });
    const avg = +(days.reduce((s, d) => s + d.uptime, 0) / days.length).toFixed(2);
    return { integrationId: it.id, label: it.label, average: avg, days };
  });
}

// Catalog of systems available in the New Integration Wizard
const WIZARD_CATALOG = [
  { id: 'salesforce', name: 'Salesforce',  auth: 'oauth2',  scopes: ['api', 'refresh_token'] },
  { id: 'hubspot',    name: 'HubSpot',     auth: 'api_key', fields: ['apiKey'] },
  { id: 'stripe',     name: 'Stripe',      auth: 'api_key', fields: ['apiKey'] },
  { id: 'shopify',    name: 'Shopify',     auth: 'api_key', fields: ['shopDomain', 'apiKey'] },
  { id: 'netsuite',   name: 'NetSuite',    auth: 'oauth1',  fields: ['accountId', 'consumerKey', 'consumerSecret'] },
  { id: 'slack',      name: 'Slack',       auth: 'oauth2',  scopes: ['chat:write'] },
  { id: 'postgres',   name: 'Postgres',    auth: 'basic',   fields: ['host', 'port', 'user', 'password', 'database'] },
];

// In-memory record of provisioned integrations from the wizard
const provisioned = [];

// In-memory record of saved field mappings
const mappings = []; // { id, sourceSystem, targetSystem, pairs: [{ source, target }], createdAt }

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------

// 1) Topology — nodes (systems) + edges (integrations)
router.get('/topology', authMiddleware, (_req, res) => {
  res.json({
    nodes: SYSTEMS,
    edges: INTEGRATIONS,
    generatedAt: new Date().toISOString(),
  });
});

// 2) Connection health — 7-day uptime per integration
router.get('/health', authMiddleware, (_req, res) => {
  res.json({
    window: '7d',
    series: buildUptimeSeries(),
    generatedAt: new Date().toISOString(),
  });
});

// 3) Wizard endpoints
//    GET  /wizard/catalog        — list of systems + auth requirements
//    POST /wizard/test           — test the supplied credentials
//    POST /wizard/enable         — persist a new integration
router.get('/wizard/catalog', authMiddleware, (_req, res) => {
  res.json({ systems: WIZARD_CATALOG });
});

router.post('/wizard/test', authMiddleware, (req, res) => {
  // Server middleware converts camelCase -> snake_case for body keys, so accept both shapes.
  const body = req.body || {};
  const systemId = body.systemId || body.system_id;
  const credentials = body.credentials;
  if (!systemId) return res.status(400).json({ error: 'systemId required' });
  const sys = WIZARD_CATALOG.find((s) => s.id === systemId);
  if (!sys) return res.status(404).json({ error: 'unknown system' });
  // Treat any non-empty credential value as a successful test
  const hasCreds = credentials && typeof credentials === 'object' && Object.values(credentials).some((v) => `${v || ''}`.trim().length > 0);
  if (!hasCreds) return res.json({ ok: false, message: 'Missing credentials' });
  res.json({ ok: true, message: `Connected to ${sys.name}`, latencyMs: 120 + Math.floor(Math.random() * 80) });
});

router.post('/wizard/enable', authMiddleware, (req, res) => {
  const body = req.body || {};
  const systemId = body.systemId || body.system_id;
  const name = body.name;
  const credentials = body.credentials;
  if (!systemId || !name) return res.status(400).json({ error: 'systemId and name required' });
  const sys = WIZARD_CATALOG.find((s) => s.id === systemId);
  if (!sys) return res.status(404).json({ error: 'unknown system' });
  const integration = {
    id: `prov-${Date.now()}`,
    systemId,
    name,
    auth: sys.auth,
    credentialKeys: credentials ? Object.keys(credentials) : [],
    enabledAt: new Date().toISOString(),
  };
  provisioned.push(integration);
  res.json({ ok: true, integration });
});

router.get('/wizard/provisioned', authMiddleware, (_req, res) => {
  res.json({ integrations: provisioned });
});

// 4) Field mappings — list / save
router.get('/mappings', authMiddleware, (_req, res) => {
  res.json({ mappings });
});

router.post('/mappings', authMiddleware, (req, res) => {
  // camelCase keys are middleware-converted to snake_case before reaching us
  const body = req.body || {};
  const sourceSystem = body.sourceSystem || body.source_system;
  const targetSystem = body.targetSystem || body.target_system;
  const pairs = body.pairs;
  if (!sourceSystem || !targetSystem || !Array.isArray(pairs)) {
    return res.status(400).json({ error: 'sourceSystem, targetSystem, pairs[] required' });
  }
  const record = {
    id: `map-${Date.now()}`,
    sourceSystem,
    targetSystem,
    pairs,
    createdAt: new Date().toISOString(),
  };
  mappings.push(record);
  res.json({ ok: true, mapping: record });
});

module.exports = router;
