const test = require('node:test');
const assert = require('node:assert/strict');
const { toCamelCase, toSnakeCase } = require('../src/utils');

test('request conversion handles nested API fields without changing workflow payload keys', () => {
  assert.deepEqual(toSnakeCase({
    maxAttempts: 3,
    definition: { steps: [{ connectionId: 'one' }] },
    credentials: { bearerToken: 'secret' },
    input: { customerId: 7 },
  }), {
    max_attempts: 3,
    definition: { steps: [{ connection_id: 'one' }] },
    credentials: { bearer_token: 'secret' },
    input: { customerId: 7 },
  });
});

test('response conversion preserves opaque integration data and audit details', () => {
  assert.deepEqual(toCamelCase({
    created_at: 'now',
    steps: [{ step_index: 0 }],
    output: { external_order_id: 9 },
    details: { workflow_id: 'evidence-value' },
  }), {
    createdAt: 'now',
    steps: [{ stepIndex: 0 }],
    output: { external_order_id: 9 },
    details: { workflow_id: 'evidence-value' },
  });
});
