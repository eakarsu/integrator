const dns = require('node:dns').promises;
const net = require('node:net');
const { HttpError } = require('../errors');
const { getConfig } = require('../config');

function isPrivateAddress(address) {
  if (address.toLowerCase().startsWith('::ffff:')) return true;
  if (net.isIPv4(address)) {
    const octets = address.split('.').map(Number);
    return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  }
  const normalized = address.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb');
}

async function assertSafeConnectorUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (_error) {
    throw new HttpError(400, 'INVALID_CONNECTOR_URL', 'Connector URL is invalid');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new HttpError(400, 'INVALID_CONNECTOR_URL', 'Connector URL must use HTTP(S) without embedded credentials');
  }
  if (url.protocol !== 'https:' && !getConfig().allowInsecureConnectorHttp) {
    throw new HttpError(400, 'INSECURE_CONNECTOR_URL', 'Connector URL must use HTTPS');
  }
  if (!getConfig().allowPrivateConnectorHosts) {
    let answers;
    try {
      answers = await dns.lookup(url.hostname, { all: true });
    } catch (_error) {
      throw new HttpError(400, 'CONNECTOR_HOST_UNRESOLVED', 'Connector host could not be resolved');
    }
    if (!answers.length || answers.some(({ address }) => isPrivateAddress(address))) {
      throw new HttpError(400, 'PRIVATE_CONNECTOR_HOST', 'Private and loopback connector hosts are disabled');
    }
  }
  return url;
}

module.exports = { assertSafeConnectorUrl, isPrivateAddress };
