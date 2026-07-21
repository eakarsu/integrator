require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../../.env'), quiet: true });
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { appendAudit } = require('../services/audit');
const { assertSchemaCurrent } = require('../services/schemaState');

const input = z.object({
  tenantName: z.string().trim().min(1).max(120),
  adminName: z.string().trim().min(1).max(120),
  adminEmail: z.email().max(320).transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(12).max(128),
}).parse({
  tenantName: process.env.PROVISION_TENANT_NAME || process.env.PROVISION_COMPANY_NAME,
  adminName: process.env.PROVISION_ADMIN_NAME,
  adminEmail: process.env.PROVISION_ADMIN_EMAIL,
  adminPassword: process.env.PROVISION_ADMIN_PASSWORD,
});

if (process.env.BOOTSTRAP_ACKNOWLEDGEMENT !== 'create-initial-admin') {
  throw new Error('BOOTSTRAP_ACKNOWLEDGEMENT=create-initial-admin is required');
}

async function main() {
  await assertSchemaCurrent(db);
  const passwordHash = await bcrypt.hash(input.adminPassword, 12);
  const result = await db.transaction(async (client) => {
    const existing = await client.query('SELECT id FROM users WHERE email=$1', [input.adminEmail]);
    if (existing.rows[0]) throw new Error('An account with PROVISION_ADMIN_EMAIL already exists; refusing an ambiguous provision operation');
    const tenant = await client.query('INSERT INTO tenants(name) VALUES ($1) RETURNING id', [input.tenantName]);
    const user = await client.query(
      `INSERT INTO users(tenant_id,name,email,password_hash,role)
       VALUES ($1,$2,$3,$4,'admin') RETURNING id`,
      [tenant.rows[0].id, input.adminName, input.adminEmail, passwordHash],
    );
    await client.query('UPDATE users SET created_by=id WHERE id=$1', [user.rows[0].id]);
    await appendAudit(client, {
      tenantId: tenant.rows[0].id,
      actorId: user.rows[0].id,
      action: 'tenant.provisioned',
      resourceType: 'tenant',
      resourceId: tenant.rows[0].id,
      details: {},
    });
    return { created: true, tenantId: tenant.rows[0].id, userId: user.rows[0].id };
  });
  console.log(JSON.stringify(result));
}

main().then(() => db.close()).catch(async (error) => {
  console.error(error.message);
  await db.close();
  process.exit(1);
});
