require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');

const authMiddleware = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const connectionsRoutes = require('./routes/connections');
const apisRoutes = require('./routes/apis');
const workflowsRoutes = require('./routes/workflows');
const transformationsRoutes = require('./routes/transformations');
const connectorsRoutes = require('./routes/connectors');
const endpointsRoutes = require('./routes/endpoints');
const schedulesRoutes = require('./routes/schedules');
const logsRoutes = require('./routes/logs');
const alertsRoutes = require('./routes/alerts');
const webhooksRoutes = require('./routes/webhooks');
const templatesRoutes = require('./routes/templates');
const usersRoutes = require('./routes/users');
const settingsRoutes = require('./routes/settings');
const errorRetriesRoutes = require('./routes/errorRetries');
const aiRoutes = require('./routes/ai');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const { toCamelCase, toSnakeCase } = require('./utils');

// Convert incoming camelCase to snake_case for DB
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = toSnakeCase(req.body);
  }
  // Override res.json to convert outgoing to camelCase
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (data && typeof data === 'object') {
      return originalJson(toCamelCase(data));
    }
    return originalJson(data);
  };
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/connections', authMiddleware, connectionsRoutes);
app.use('/api/apis', authMiddleware, apisRoutes);
app.use('/api/workflows', authMiddleware, workflowsRoutes);
app.use('/api/transformations', authMiddleware, transformationsRoutes);
app.use('/api/connectors', authMiddleware, connectorsRoutes);
app.use('/api/endpoints', authMiddleware, endpointsRoutes);
app.use('/api/schedules', authMiddleware, schedulesRoutes);
app.use('/api/logs', authMiddleware, logsRoutes);
app.use('/api/alerts', authMiddleware, alertsRoutes);
app.use('/api/webhooks', authMiddleware, webhooksRoutes);
app.use('/api/templates', authMiddleware, templatesRoutes);
app.use('/api/users', authMiddleware, usersRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/error-retries', authMiddleware, errorRetriesRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/connector-library', require('./routes/connectorLibrary')); app.use('/api/visual-builder', require('./routes/visualBuilder')); app.use('/api/pii-masking', require('./routes/piiMasking')); app.use('/api/connector-marketplace', require('./routes/connectorMarketplace')); app.use('/api/replay-fix', require('./routes/replayFix')); app.use('/api/auto-docs', require('./routes/autoDocs'));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Integrator backend running on port ${PORT}`);
});

module.exports = app;

// === Batch 10 Gaps & Frontend Mounts === (mounts)
app.use('/api/gap-ai-covers-mapping-error-workflow-cost', require('./routes/gap_ai_covers_mapping_error_workflow_cost'));
app.use('/api/gap-ai-powered-data-masking-pii-detection', require('./routes/gap_ai_powered_data_masking_pii_detection'));
app.use('/api/gap-ai-for-replay-and-fix-on', require('./routes/gap_ai_for_replay_and_fix_on'));
app.use('/api/gap-ai-auto-doc-generator-for-integrations', require('./routes/gap_ai_auto_doc_generator_for_integrations'));
app.use('/api/gap-streaming-chat-assistant-with-flow-execution', require('./routes/gap_streaming_chat_assistant_with_flow_execution'));
app.use('/api/gap-no-pre-built-connector-library-salesforce', require('./routes/gap_no_pre_built_connector_library_salesforce'));
app.use('/api/gap-no-visual-workflow-builder-ui', require('./routes/gap_no_visual_workflow_builder_ui'));
app.use('/api/gap-no-tenant-isolation', require('./routes/gap_no_tenant_isolation'));
app.use('/api/gap-no-sla-based-pricing-metering', require('./routes/gap_no_sla_based_pricing_metering'));
app.use('/api/gap-no-audit-log-review-ui', require('./routes/gap_no_audit_log_review_ui'));
app.use('/api/gap-no-sdk-for-custom-connector-authors', require('./routes/gap_no_sdk_for_custom_connector_authors'));
app.use('/api/gap-no-marketplace-for-community-connectors', require('./routes/gap_no_marketplace_for_community_connectors'));
