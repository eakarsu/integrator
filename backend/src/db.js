const { Pool } = require('pg');
const { getConfig } = require('./config');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: getConfig().databaseUrl,
      max: getConfig().dbPoolSize,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error', error));
  }
  return pool;
}

async function transaction(fn, options = {}) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    if (options.isolationLevel) {
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
    }
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getPool,
  query(...args) {
    return getPool().query(...args);
  },
  transaction,
  async close() {
    if (pool) await pool.end();
    pool = undefined;
  },
};
