const { getConfig } = require('../config');
const { decryptCredentials } = require('./credentials');
const { assertSafeConnectorUrl } = require('./networkPolicy');

async function readLimitedBody(response, maxBytes) {
  if (!response.body) return '';
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    const error = new Error(`Connector response exceeds ${maxBytes} bytes`);
    error.retryable = false;
    throw error;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      const error = new Error(`Connector response exceeds ${maxBytes} bytes`);
      error.retryable = false;
      throw error;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function executeHttpStep(connection, step, input, context = {}) {
  const config = getConfig();
  let base;
  let url;
  try {
    base = await assertSafeConnectorUrl(connection.base_url);
    url = new URL(step.path || '/', base);
    if (url.origin !== base.origin) throw new Error('Workflow step cannot change connector origin');
    await assertSafeConnectorUrl(url.toString());
  } catch (error) {
    error.retryable = false;
    throw error;
  }

  const credentials = decryptCredentials(connection.encrypted_credentials);
  const headers = { accept: 'application/json', 'content-type': 'application/json' };
  const bearerToken = credentials.bearer_token || credentials.bearerToken;
  const apiKey = credentials.api_key || credentials.apiKey;
  const apiKeyHeader = credentials.api_key_header || credentials.apiKeyHeader;
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  if (apiKey && apiKeyHeader) headers[apiKeyHeader.toLowerCase()] = apiKey;
  if (context.idempotencyKey) headers['idempotency-key'] = context.idempotencyKey;
  if (context.runId) headers['x-integrator-run-id'] = context.runId;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    const response = await fetch(url, {
      method: step.method || 'POST',
      headers,
      body: ['GET', 'HEAD'].includes(step.method) ? undefined : JSON.stringify(input),
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await readLimitedBody(response, config.maxResponseBytes);
    if (!response.ok) {
      const error = new Error(`Connector returned HTTP ${response.status}`);
      error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      error.status = response.status;
      throw error;
    }
    if (!text) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) return { body: text };
    try {
      return JSON.parse(text);
    } catch (error) {
      error.retryable = false;
      throw error;
    }
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { executeHttpStep, readLimitedBody };
