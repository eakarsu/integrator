require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../.env'), quiet: true });
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../db');

async function main() {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const applied = await db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('integrator-schema-migrations'))");
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE name=$1', [file]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration ${file} has changed`);
        return false;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)', [file, checksum]);
      return true;
    });
    if (applied) console.log(`Applied ${file}`);
  }
}

main().then(() => db.close()).catch(async (error) => {
  console.error(error.message);
  await db.close();
  process.exit(1);
});
