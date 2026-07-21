require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env'), quiet: true });
const { getConfig } = require('./config');
const db = require('./db');
const { claimNextRun, executeClaimedRun } = require('./services/workflowEngine');
const { assertSchemaCurrent } = require('./services/schemaState');

let stopping = false;
const config = getConfig();

async function runOnce() {
  const run = await claimNextRun(config.instanceId);
  if (!run) return false;
  const result = await executeClaimedRun(run);
  console.log(JSON.stringify({ event: 'workflow_run_processed', runId: run.id, status: result.status, attempt: run.attempts }));
  return true;
}

async function main() {
  await assertSchemaCurrent(db);
  const once = process.argv.includes('--once');
  do {
    const processed = await runOnce();
    if (once) break;
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (!stopping);
  await db.close();
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

main().catch(async (error) => {
  console.error('Worker failed', error);
  await db.close();
  process.exit(1);
});
