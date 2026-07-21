const test = require('node:test');
const assert = require('node:assert/strict');
const { canCancel, requestHash, retryDelay } = require('../src/services/workflowEngine');
const { isPrivateAddress } = require('../src/services/networkPolicy');

test('request hashes are deterministic across object key order', () => {
  assert.equal(requestHash({ a: 1, b: [2, 3] }), requestHash({ b: [2, 3], a: 1 }));
  assert.notEqual(requestHash({ a: 1 }), requestHash({ a: 2 }));
});

test('only non-running, non-terminal runs can be cancelled', () => {
  assert.equal(canCancel('queued'), true);
  assert.equal(canCancel('retry_scheduled'), true);
  assert.equal(canCancel('running'), false);
  assert.equal(canCancel('succeeded'), false);
  assert.equal(canCancel('dead_letter'), false);
  assert.equal(canCancel('cancelled'), false);
});

test('retry delay grows exponentially and is capped', () => {
  assert.equal(retryDelay(1, 1000), 1100);
  assert.equal(retryDelay(3, 1000), 4400);
  assert.equal(retryDelay(30, 1000), 3600000);
});

test('network policy recognizes private IPv4 and IPv6 ranges', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '172.20.1.1', '192.168.1.10', '169.254.1.1', '::1', 'fd00::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});
