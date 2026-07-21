require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env'), quiet: true });
const { createApp } = require('./app');
const { getConfig } = require('./config');
const db = require('./db');
const { assertSchemaCurrent } = require('./services/schemaState');

let server;

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down`);
  if (!server) {
    await db.close();
    process.exit(0);
  }
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

async function main() {
  const config = getConfig();
  await assertSchemaCurrent(db);
  server = createApp().listen(config.port, config.host, () => {
    console.log(`Integrator API listening on http://${config.host}:${config.port}`);
  });
}

main().catch(async (error) => {
  console.error(`Integrator API startup failed: ${error.message}`);
  await db.close();
  process.exit(1);
});
