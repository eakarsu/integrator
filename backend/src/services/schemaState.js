const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function expectedMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const names = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(names.map(async (name) => {
    const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8');
    return { name, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
  }));
}

async function assertSchemaCurrent(queryable) {
  const expected = await expectedMigrations();
  const result = await queryable.query('SELECT name, checksum FROM schema_migrations ORDER BY name');
  const applied = new Map(result.rows.map((row) => [row.name, row.checksum]));
  for (const migration of expected) {
    if (!applied.has(migration.name)) throw new Error(`Database migration ${migration.name} is not applied`);
    if (applied.get(migration.name) !== migration.checksum) {
      throw new Error(`Database migration ${migration.name} checksum does not match the repository`);
    }
  }
  if (result.rows.length !== expected.length) {
    const expectedNames = new Set(expected.map((migration) => migration.name));
    const unknown = result.rows.filter((migration) => !expectedNames.has(migration.name)).map((migration) => migration.name);
    throw new Error(unknown.length
      ? `Database has migrations absent from the repository: ${unknown.join(', ')}`
      : `Database migration count is ${result.rows.length}; expected ${expected.length}`);
  }
  return { expected: expected.length, applied: result.rows.length };
}

module.exports = { assertSchemaCurrent, expectedMigrations };
