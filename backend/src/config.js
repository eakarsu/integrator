const crypto = require('node:crypto');

function required(name, minimumLength = 1) {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} must be configured${minimumLength > 1 ? ` with at least ${minimumLength} characters` : ''}`);
  }
  return value;
}

function requiredSecret(name, minimumLength) {
  const value = required(name, minimumLength);
  if (/replace[-_ ]?(me|with)|change[-_ ]?me|your[-_ ]/i.test(value)) {
    throw new Error(`${name} still contains a placeholder`);
  }
  return value;
}

function boundedInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name] || String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number.parseInt(raw, 10);
  if (value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

function allowedOrigins(nodeEnv) {
  const raw = process.env.ALLOWED_ORIGINS || (nodeEnv === 'production' ? required('ALLOWED_ORIGINS') : 'http://localhost:5173');
  const origins = raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (!origins.length || origins.includes('*')) throw new Error('ALLOWED_ORIGINS must contain explicit origins');
  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch (_error) {
      throw new Error(`ALLOWED_ORIGINS contains an invalid origin: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error(`ALLOWED_ORIGINS must contain URL origins without paths or credentials: ${origin}`);
    }
  }
  return origins;
}

function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (nodeEnv === 'production' && !encryptionKey) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be configured in production');
  }

  if (encryptionKey) {
    const decoded = Buffer.from(encryptionKey, 'base64');
    if (decoded.length !== 32) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    }
  }

  return {
    nodeEnv,
    port: boundedInteger('PORT', 3001, 1, 65535),
    host: process.env.BACKEND_HOST || '127.0.0.1',
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: requiredSecret('JWT_SECRET', 32),
    encryptionKey: encryptionKey ? Buffer.from(encryptionKey, 'base64') : null,
    allowedOrigins: allowedOrigins(nodeEnv),
    requestTimeoutMs: boundedInteger('CONNECTOR_TIMEOUT_MS', 10000, 100, 15000),
    maxResponseBytes: boundedInteger('CONNECTOR_MAX_RESPONSE_BYTES', 1048576, 1024, 10485760),
    dbPoolSize: boundedInteger('DB_POOL_SIZE', 10, 1, 100),
    trustProxyHops: boundedInteger('TRUST_PROXY_HOPS', 0, 0, 10),
    allowPrivateConnectorHosts: process.env.ALLOW_PRIVATE_CONNECTOR_HOSTS === 'true',
    allowInsecureConnectorHttp: process.env.ALLOW_INSECURE_CONNECTOR_HTTP === 'true',
    instanceId: process.env.INSTANCE_ID || `${process.pid}-${crypto.randomUUID()}`,
  };
}

let cached;

module.exports = {
  getConfig() {
    if (!cached) cached = loadConfig();
    return cached;
  },
  resetConfigForTests() {
    cached = undefined;
  },
  loadConfig,
};
