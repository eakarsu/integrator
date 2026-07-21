const crypto = require('node:crypto');
const { getConfig } = require('../config');

function encryptCredentials(value) {
  if (!value || Object.keys(value).length === 0) return null;
  const key = getConfig().encryptionKey;
  if (!key) throw new Error('CREDENTIAL_ENCRYPTION_KEY is required before storing connector credentials');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), encrypted]);
}

function decryptCredentials(value) {
  if (!value) return {};
  const key = getConfig().encryptionKey;
  if (!key) throw new Error('CREDENTIAL_ENCRYPTION_KEY is required to use connector credentials');
  const bytes = Buffer.from(value);
  if (bytes[0] !== 1) throw new Error('Unsupported credential envelope');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(1, 13));
  decipher.setAuthTag(bytes.subarray(13, 29));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(29)), decipher.final()]).toString('utf8'));
}

module.exports = { encryptCredentials, decryptCredentials };
