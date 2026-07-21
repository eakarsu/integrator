const test = require('node:test');
const assert = require('node:assert/strict');
const { assertSchemaCurrent, expectedMigrations } = require('../src/services/schemaState');

test('schema guard accepts the repository migration ledger', async () => {
  const expected = await expectedMigrations();
  const result = await assertSchemaCurrent({ query: async () => ({ rows: expected }) });
  assert.deepEqual(result, { expected: expected.length, applied: expected.length });
});

test('schema guard rejects missing and checksum-mismatched migrations', async () => {
  const expected = await expectedMigrations();
  await assert.rejects(
    assertSchemaCurrent({ query: async () => ({ rows: expected.slice(0, -1) }) }),
    /is not applied/,
  );
  await assert.rejects(
    assertSchemaCurrent({
      query: async () => ({ rows: expected.map((migration, index) => index ? migration : { ...migration, checksum: '0'.repeat(64) }) }),
    }),
    /checksum does not match/,
  );
  await assert.rejects(
    assertSchemaCurrent({ query: async () => ({ rows: [...expected, { name: '999_unknown.sql', checksum: '0'.repeat(64) }] }) }),
    /absent from the repository/,
  );
});
