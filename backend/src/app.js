const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const { getConfig } = require('./config');
const auth = require('./middleware/auth');
const { HttpError } = require('./errors');
const { assertSchemaCurrent } = require('./services/schemaState');
const { toCamelCase, toSnakeCase } = require('./utils');

function createApp() {
  const config = getConfig();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, 'ORIGIN_DENIED', 'Origin is not allowed'));
    },
    credentials: false,
  }));
  app.use(express.json({ limit: '256kb' }));
  app.use((req, res, next) => {
    req.requestId = req.get('X-Request-Id') || crypto.randomUUID();
    res.set('X-Request-Id', req.requestId);
    if (req.body && typeof req.body === 'object') req.body = toSnakeCase(req.body);
    const originalJson = res.json.bind(res);
    res.json = (data) => originalJson(data && typeof data === 'object' ? toCamelCase(data) : data);
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      console.log(JSON.stringify({
        event: 'http_request', requestId: req.requestId, method: req.method,
        path: req.originalUrl, status: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
      }));
    });
    next();
  });

  app.get('/api/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/health/ready', async (_req, res) => {
    try {
      const schema = await assertSchemaCurrent(db);
      res.json({ status: 'ready', schema });
    } catch (_error) {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), require('./routes/auth'));
  app.use('/api/connections', auth, require('./routes/connections'));
  app.use('/api/workflows', auth, require('./routes/workflows'));
  app.use('/api/users', auth, require('./routes/users'));
  app.use('/api/audit', auth, require('./routes/audit'));

  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Route not found')));
  app.use((error, req, res, _next) => {
    const status = error.status || (error.code === '23505' ? 409 : 500);
    const code = error.code === '23505' ? 'CONFLICT' : (error.code || 'INTERNAL_ERROR');
    if (status >= 500) console.error('Unhandled request error', { requestId: req.requestId, error });
    res.status(status).json({
      error: status >= 500 ? 'Internal server error' : error.message,
      code,
      details: status < 500 ? error.details : undefined,
      requestId: req.requestId,
    });
  });
  return app;
}

module.exports = { createApp };
