const test = require('node:test');
const assert = require('node:assert/strict');
const { loadConfig } = require('../src/config');

function withEnvironment(changes, fn) {
  const previous = Object.fromEntries(Object.keys(changes).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const base = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://example.test/integrator',
  JWT_SECRET: 'a-production-jwt-secret-that-is-long-enough',
  ALLOWED_ORIGINS: 'https://integrator.example.test',
  CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
};

test('production configuration fails closed without credential encryption', () => {
  withEnvironment({ ...base, CREDENTIAL_ENCRYPTION_KEY: undefined }, () => {
    assert.throws(() => loadConfig(), /CREDENTIAL_ENCRYPTION_KEY/);
  });
});

test('configuration rejects wildcard origins and unsafe numeric limits', () => {
  withEnvironment({ ...base, ALLOWED_ORIGINS: '*' }, () => {
    assert.throws(() => loadConfig(), /explicit origins/);
  });
  withEnvironment({ ...base, CONNECTOR_TIMEOUT_MS: '900000' }, () => {
    assert.throws(() => loadConfig(), /CONNECTOR_TIMEOUT_MS/);
  });
  withEnvironment({ ...base, JWT_SECRET: 'replace-with-at-least-32-random-characters' }, () => {
    assert.throws(() => loadConfig(), /placeholder/);
  });
});
