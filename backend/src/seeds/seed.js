require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'integrator_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT) || 5432,
});

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS logs CASCADE;
      DROP TABLE IF EXISTS schedules CASCADE;
      DROP TABLE IF EXISTS error_retries CASCADE;
      DROP TABLE IF EXISTS settings CASCADE;
      DROP TABLE IF EXISTS webhooks CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS templates CASCADE;
      DROP TABLE IF EXISTS endpoints CASCADE;
      DROP TABLE IF EXISTS connectors CASCADE;
      DROP TABLE IF EXISTS transformations CASCADE;
      DROP TABLE IF EXISTS workflows CASCADE;
      DROP TABLE IF EXISTS apis CASCADE;
      DROP TABLE IF EXISTS connections CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    console.log('Creating tables...');

    // Users table
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
        department VARCHAR(255),
        last_login TIMESTAMP,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Connections table
    await client.query(`
      CREATE TABLE connections (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) CHECK (type IN ('REST', 'SOAP', 'GraphQL', 'SFTP', 'Database')),
        host VARCHAR(500),
        port INTEGER,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
        auth_type VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // APIs table
    await client.query(`
      CREATE TABLE apis (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        method VARCHAR(10) CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
        endpoint VARCHAR(500),
        description TEXT,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'draft')),
        rate_limit INTEGER,
        version VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Workflows table
    await client.query(`
      CREATE TABLE workflows (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft', 'error')),
        trigger_type VARCHAR(50) CHECK (trigger_type IN ('schedule', 'webhook', 'manual', 'event')),
        steps_count INTEGER DEFAULT 0,
        last_run TIMESTAMP,
        success_rate DECIMAL(5,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Transformations table
    await client.query(`
      CREATE TABLE transformations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        source_format VARCHAR(50) CHECK (source_format IN ('JSON', 'XML', 'CSV', 'YAML')),
        target_format VARCHAR(50) CHECK (target_format IN ('JSON', 'XML', 'CSV', 'YAML')),
        description TEXT,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        mapping_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Connectors table
    await client.query(`
      CREATE TABLE connectors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(255),
        category VARCHAR(50) CHECK (category IN ('CRM', 'ERP', 'Database', 'Cloud', 'Messaging', 'Analytics')),
        version VARCHAR(50),
        status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'installed', 'deprecated')),
        description TEXT,
        icon VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Endpoints table
    await client.query(`
      CREATE TABLE endpoints (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        path VARCHAR(500),
        method VARCHAR(10),
        description TEXT,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        auth_required BOOLEAN DEFAULT true,
        rate_limit INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Schedules table
    await client.query(`
      CREATE TABLE schedules (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
        cron_expression VARCHAR(100),
        description TEXT,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
        last_run TIMESTAMP,
        next_run TIMESTAMP,
        timezone VARCHAR(100) DEFAULT 'UTC',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Logs table
    await client.query(`
      CREATE TABLE logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(255),
        resource_type VARCHAR(100),
        resource_id INTEGER,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        details TEXT,
        level VARCHAR(50) DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error', 'debug')),
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Alerts table
    await client.query(`
      CREATE TABLE alerts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        condition TEXT,
        threshold VARCHAR(255),
        channel VARCHAR(50) DEFAULT 'email' CHECK (channel IN ('email', 'slack', 'webhook', 'sms')),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'muted', 'triggered')),
        severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        last_triggered TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Webhooks table
    await client.query(`
      CREATE TABLE webhooks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500),
        events TEXT,
        secret VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        retry_count INTEGER DEFAULT 3,
        last_triggered TIMESTAMP,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Templates table
    await client.query(`
      CREATE TABLE templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(255),
        complexity VARCHAR(50) DEFAULT 'beginner' CHECK (complexity IN ('beginner', 'intermediate', 'advanced')),
        estimated_time VARCHAR(100),
        steps_count INTEGER DEFAULT 0,
        downloads INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Settings table
    await client.query(`
      CREATE TABLE settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        value TEXT,
        category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'security', 'integration', 'notification', 'performance')),
        description TEXT,
        is_secret BOOLEAN DEFAULT false,
        updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Error Retries table
    await client.query(`
      CREATE TABLE error_retries (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        max_retries INTEGER DEFAULT 3,
        backoff_strategy VARCHAR(50) DEFAULT 'exponential' CHECK (backoff_strategy IN ('linear', 'exponential', 'fixed')),
        delay_ms INTEGER DEFAULT 1000,
        description TEXT,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        applied_to VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Tables created successfully.');
    console.log('Seeding data...');

    // Seed Users (15 users, first is admin)
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('password123', 10);

    await client.query(`
      INSERT INTO users (name, email, password, role, status, department, last_login, avatar_url) VALUES
      ('Admin User', 'admin@integrator.com', $1, 'admin', 'active', 'Engineering', NOW(), 'https://ui-avatars.com/api/?name=Admin+User'),
      ('Sarah Chen', 'sarah.chen@integrator.com', $2, 'editor', 'active', 'Engineering', NOW() - INTERVAL '2 hours', 'https://ui-avatars.com/api/?name=Sarah+Chen'),
      ('Marcus Johnson', 'marcus.j@integrator.com', $2, 'editor', 'active', 'DevOps', NOW() - INTERVAL '1 day', 'https://ui-avatars.com/api/?name=Marcus+Johnson'),
      ('Emily Rodriguez', 'emily.r@integrator.com', $2, 'viewer', 'active', 'Product', NOW() - INTERVAL '3 days', 'https://ui-avatars.com/api/?name=Emily+Rodriguez'),
      ('James Kim', 'james.kim@integrator.com', $2, 'admin', 'active', 'Engineering', NOW() - INTERVAL '5 hours', 'https://ui-avatars.com/api/?name=James+Kim'),
      ('Priya Patel', 'priya.p@integrator.com', $2, 'editor', 'active', 'Data Engineering', NOW() - INTERVAL '12 hours', 'https://ui-avatars.com/api/?name=Priya+Patel'),
      ('David Wilson', 'david.w@integrator.com', $2, 'viewer', 'active', 'Sales', NULL, 'https://ui-avatars.com/api/?name=David+Wilson'),
      ('Lisa Thompson', 'lisa.t@integrator.com', $2, 'editor', 'inactive', 'Engineering', NOW() - INTERVAL '30 days', 'https://ui-avatars.com/api/?name=Lisa+Thompson'),
      ('Robert Garcia', 'robert.g@integrator.com', $2, 'viewer', 'pending', 'Marketing', NULL, 'https://ui-avatars.com/api/?name=Robert+Garcia'),
      ('Aisha Mohammed', 'aisha.m@integrator.com', $2, 'editor', 'active', 'Engineering', NOW() - INTERVAL '6 hours', 'https://ui-avatars.com/api/?name=Aisha+Mohammed'),
      ('Tom Baker', 'tom.b@integrator.com', $2, 'viewer', 'active', 'Support', NOW() - INTERVAL '2 days', 'https://ui-avatars.com/api/?name=Tom+Baker'),
      ('Nina Kowalski', 'nina.k@integrator.com', $2, 'editor', 'active', 'Data Engineering', NOW() - INTERVAL '8 hours', 'https://ui-avatars.com/api/?name=Nina+Kowalski'),
      ('Carlos Mendez', 'carlos.m@integrator.com', $2, 'viewer', 'active', 'Finance', NOW() - INTERVAL '4 days', 'https://ui-avatars.com/api/?name=Carlos+Mendez'),
      ('Hannah Lee', 'hannah.l@integrator.com', $2, 'admin', 'active', 'Engineering', NOW() - INTERVAL '1 hour', 'https://ui-avatars.com/api/?name=Hannah+Lee'),
      ('Yuki Tanaka', 'yuki.t@integrator.com', $2, 'editor', 'active', 'DevOps', NOW() - INTERVAL '10 hours', 'https://ui-avatars.com/api/?name=Yuki+Tanaka')
    `, [adminPassword, userPassword]);
    console.log('  Users seeded (15 rows)');

    // Seed Connections
    await client.query(`
      INSERT INTO connections (name, type, host, port, status, auth_type, description) VALUES
      ('Salesforce Production', 'REST', 'https://api.salesforce.com', 443, 'active', 'OAuth2', 'Main Salesforce CRM connection for customer data sync'),
      ('SAP ERP System', 'SOAP', 'https://sap.company.com', 8443, 'active', 'Basic Auth', 'SAP ERP backend for order and inventory management'),
      ('MongoDB Atlas', 'Database', 'cluster0.mongodb.net', 27017, 'active', 'Connection String', 'Cloud MongoDB for analytics data storage'),
      ('AWS S3 File Store', 'REST', 'https://s3.amazonaws.com', 443, 'active', 'AWS Signature', 'S3 bucket for file transfer and backup'),
      ('GitHub API', 'GraphQL', 'https://api.github.com', 443, 'active', 'Token', 'GitHub integration for deployment tracking'),
      ('SFTP Legacy Server', 'SFTP', 'sftp.legacy.company.com', 22, 'active', 'SSH Key', 'Legacy file transfer for batch processing'),
      ('PostgreSQL Analytics', 'Database', 'db.analytics.internal', 5432, 'active', 'Basic Auth', 'Analytics database for reporting dashboards'),
      ('Stripe Payment Gateway', 'REST', 'https://api.stripe.com', 443, 'active', 'API Key', 'Payment processing integration'),
      ('Slack Notifications', 'REST', 'https://hooks.slack.com', 443, 'active', 'Webhook Token', 'Slack workspace for alert notifications'),
      ('HubSpot Marketing', 'REST', 'https://api.hubspot.com', 443, 'inactive', 'OAuth2', 'HubSpot marketing automation connection'),
      ('Oracle Database', 'Database', 'oracle.company.internal', 1521, 'error', 'Basic Auth', 'Legacy Oracle DB for finance data - connection timeout'),
      ('Azure Blob Storage', 'REST', 'https://storage.blob.core.windows.net', 443, 'active', 'SAS Token', 'Azure blob storage for document management'),
      ('Twilio SMS', 'REST', 'https://api.twilio.com', 443, 'active', 'Basic Auth', 'SMS notification service'),
      ('Elasticsearch Cluster', 'REST', 'https://search.company.internal', 9200, 'active', 'API Key', 'Full-text search and log aggregation'),
      ('Redis Cache', 'Database', 'redis.company.internal', 6379, 'active', 'Password', 'In-memory cache for session and rate limiting')
    `);
    console.log('  Connections seeded (15 rows)');

    // Seed APIs
    await client.query(`
      INSERT INTO apis (name, method, endpoint, description, status, rate_limit, version) VALUES
      ('Get Customers', 'GET', '/api/v2/customers', 'Retrieve list of all customers with pagination', 'active', 1000, 'v2.1'),
      ('Create Order', 'POST', '/api/v2/orders', 'Create a new order in the system', 'active', 500, 'v2.0'),
      ('Update Inventory', 'PUT', '/api/v1/inventory/{id}', 'Update inventory stock levels', 'active', 200, 'v1.5'),
      ('Delete User Session', 'DELETE', '/api/v1/sessions/{id}', 'Invalidate and remove a user session', 'active', 100, 'v1.0'),
      ('Get Product Catalog', 'GET', '/api/v2/products', 'Fetch complete product catalog with filters', 'active', 2000, 'v2.3'),
      ('Submit Payment', 'POST', '/api/v1/payments', 'Process a payment transaction', 'active', 300, 'v1.2'),
      ('Get Analytics Dashboard', 'GET', '/api/v3/analytics/dashboard', 'Retrieve dashboard metrics and KPIs', 'active', 500, 'v3.0'),
      ('Update Customer Profile', 'PUT', '/api/v2/customers/{id}', 'Update customer information and preferences', 'active', 400, 'v2.1'),
      ('Create Webhook', 'POST', '/api/v1/webhooks', 'Register a new webhook endpoint', 'active', 50, 'v1.0'),
      ('Get Shipping Rates', 'GET', '/api/v1/shipping/rates', 'Calculate shipping rates for orders', 'deprecated', 800, 'v1.0'),
      ('Bulk Import', 'POST', '/api/v2/import/bulk', 'Bulk import records from CSV/JSON', 'active', 10, 'v2.0'),
      ('Get Audit Log', 'GET', '/api/v1/audit', 'Retrieve system audit log entries', 'active', 200, 'v1.1'),
      ('Search Products', 'GET', '/api/v2/search', 'Full-text search across products', 'draft', 1500, 'v2.0'),
      ('Delete Stale Records', 'DELETE', '/api/v1/cleanup/stale', 'Remove records older than retention period', 'active', 5, 'v1.0'),
      ('Update Config', 'PUT', '/api/v1/config', 'Update system configuration settings', 'active', 20, 'v1.3')
    `);
    console.log('  APIs seeded (15 rows)');

    // Seed Workflows
    await client.query(`
      INSERT INTO workflows (name, description, status, trigger_type, steps_count, last_run, success_rate) VALUES
      ('Customer Sync Pipeline', 'Synchronize customer data between Salesforce and internal DB', 'active', 'schedule', 5, NOW() - INTERVAL '30 minutes', 98.50),
      ('Order Processing Flow', 'End-to-end order creation, validation, and fulfillment', 'active', 'event', 8, NOW() - INTERVAL '5 minutes', 99.20),
      ('Invoice Generation', 'Generate and send invoices for completed orders', 'active', 'schedule', 4, NOW() - INTERVAL '1 hour', 97.80),
      ('Inventory Restock Alert', 'Monitor stock levels and trigger restock notifications', 'active', 'event', 3, NOW() - INTERVAL '15 minutes', 100.00),
      ('User Onboarding', 'Automated user provisioning across systems', 'active', 'webhook', 6, NOW() - INTERVAL '2 hours', 95.30),
      ('Data Backup Pipeline', 'Daily backup of critical data to cloud storage', 'active', 'schedule', 4, NOW() - INTERVAL '12 hours', 99.90),
      ('Log Aggregation', 'Collect and centralize logs from all services', 'active', 'schedule', 3, NOW() - INTERVAL '10 minutes', 99.50),
      ('Payment Reconciliation', 'Match payments with invoices and flag discrepancies', 'paused', 'schedule', 7, NOW() - INTERVAL '2 days', 96.40),
      ('Email Campaign Sync', 'Sync email campaign data with marketing platform', 'active', 'webhook', 5, NOW() - INTERVAL '3 hours', 94.70),
      ('API Health Monitor', 'Check health of all external API connections', 'active', 'schedule', 2, NOW() - INTERVAL '5 minutes', 100.00),
      ('ETL Data Pipeline', 'Extract, transform, and load data for analytics', 'active', 'schedule', 6, NOW() - INTERVAL '6 hours', 98.10),
      ('Compliance Report Gen', 'Generate compliance reports for regulatory requirements', 'draft', 'manual', 5, NULL, 0),
      ('Webhook Relay', 'Receive external webhooks and relay to internal services', 'active', 'webhook', 3, NOW() - INTERVAL '1 minute', 99.80),
      ('Customer Churn Detection', 'Analyze customer behavior and flag churn risks', 'error', 'schedule', 4, NOW() - INTERVAL '1 day', 87.50),
      ('File Import Processor', 'Process uploaded files and import into database', 'active', 'event', 5, NOW() - INTERVAL '45 minutes', 96.90)
    `);
    console.log('  Workflows seeded (15 rows)');

    // Seed Transformations
    await client.query(`
      INSERT INTO transformations (name, source_format, target_format, description, status, mapping_count) VALUES
      ('Salesforce to Internal JSON', 'JSON', 'JSON', 'Transform Salesforce contact data to internal customer format', 'active', 24),
      ('SAP Order XML to JSON', 'XML', 'JSON', 'Convert SAP order documents to REST API format', 'active', 18),
      ('CSV Import to JSON', 'CSV', 'JSON', 'Parse bulk CSV imports into structured JSON records', 'active', 12),
      ('Analytics JSON to CSV', 'JSON', 'CSV', 'Export analytics data to CSV for reporting', 'active', 8),
      ('Config YAML to JSON', 'YAML', 'JSON', 'Convert YAML config files to JSON for API consumption', 'active', 6),
      ('Legacy XML to YAML', 'XML', 'YAML', 'Transform legacy XML configs to modern YAML format', 'active', 15),
      ('HubSpot JSON Mapping', 'JSON', 'JSON', 'Map HubSpot contact fields to internal schema', 'active', 20),
      ('Invoice JSON to XML', 'JSON', 'XML', 'Convert invoice data to XML for SAP integration', 'active', 14),
      ('Product CSV Normalizer', 'CSV', 'JSON', 'Normalize product data from various CSV sources', 'active', 10),
      ('Stripe Event Transform', 'JSON', 'JSON', 'Transform Stripe webhook events to internal event format', 'active', 9),
      ('YAML Pipeline Config', 'YAML', 'JSON', 'Parse CI/CD pipeline YAML configs', 'inactive', 5),
      ('XML Report to CSV', 'XML', 'CSV', 'Convert XML reports to downloadable CSV files', 'active', 11),
      ('JSON Schema Validator', 'JSON', 'JSON', 'Validate and transform JSON against predefined schemas', 'active', 30),
      ('CSV to XML Batch', 'CSV', 'XML', 'Batch convert CSV records to XML documents', 'active', 7),
      ('Multi-source JSON Merge', 'JSON', 'JSON', 'Merge JSON data from multiple API sources into unified format', 'active', 22)
    `);
    console.log('  Transformations seeded (15 rows)');

    // Seed Connectors
    await client.query(`
      INSERT INTO connectors (name, provider, category, version, status, description, icon) VALUES
      ('Salesforce CRM', 'Salesforce', 'CRM', '2.5.0', 'installed', 'Full Salesforce CRM integration with contacts, leads, and opportunities', 'salesforce'),
      ('HubSpot', 'HubSpot', 'CRM', '3.1.0', 'installed', 'HubSpot marketing and CRM platform connector', 'hubspot'),
      ('SAP S/4HANA', 'SAP', 'ERP', '1.8.0', 'installed', 'SAP S/4HANA ERP system integration', 'sap'),
      ('PostgreSQL', 'PostgreSQL', 'Database', '4.0.0', 'installed', 'PostgreSQL database connector with full CRUD support', 'postgresql'),
      ('MongoDB', 'MongoDB', 'Database', '3.2.1', 'installed', 'MongoDB NoSQL database connector', 'mongodb'),
      ('AWS S3', 'Amazon', 'Cloud', '2.0.0', 'installed', 'Amazon S3 cloud storage connector', 'aws'),
      ('Azure Blob', 'Microsoft', 'Cloud', '1.5.0', 'available', 'Azure Blob Storage connector', 'azure'),
      ('Slack', 'Slack', 'Messaging', '2.3.0', 'installed', 'Slack messaging and notification connector', 'slack'),
      ('SendGrid', 'Twilio', 'Messaging', '1.2.0', 'available', 'SendGrid email delivery service connector', 'sendgrid'),
      ('Google Analytics', 'Google', 'Analytics', '4.1.0', 'installed', 'Google Analytics 4 data connector', 'google-analytics'),
      ('Mixpanel', 'Mixpanel', 'Analytics', '2.0.0', 'available', 'Mixpanel product analytics connector', 'mixpanel'),
      ('Oracle DB', 'Oracle', 'Database', '1.3.0', 'deprecated', 'Oracle Database connector (use PostgreSQL instead)', 'oracle'),
      ('Microsoft Dynamics', 'Microsoft', 'ERP', '2.1.0', 'available', 'Microsoft Dynamics 365 ERP connector', 'dynamics'),
      ('Kafka', 'Apache', 'Messaging', '3.0.0', 'installed', 'Apache Kafka event streaming connector', 'kafka'),
      ('Snowflake', 'Snowflake', 'Database', '1.7.0', 'available', 'Snowflake cloud data warehouse connector', 'snowflake')
    `);
    console.log('  Connectors seeded (15 rows)');

    // Seed Endpoints
    await client.query(`
      INSERT INTO endpoints (name, path, method, description, status, auth_required, rate_limit) VALUES
      ('Customer List', '/custom/customers', 'GET', 'List all customers with filtering and pagination', 'active', true, 1000),
      ('Customer Create', '/custom/customers', 'POST', 'Create a new customer record', 'active', true, 200),
      ('Customer Update', '/custom/customers/:id', 'PUT', 'Update an existing customer record', 'active', true, 200),
      ('Customer Delete', '/custom/customers/:id', 'DELETE', 'Delete a customer record', 'active', true, 50),
      ('Order Submit', '/custom/orders', 'POST', 'Submit a new order', 'active', true, 500),
      ('Order Status', '/custom/orders/:id/status', 'GET', 'Get order status and tracking info', 'active', true, 2000),
      ('Product Search', '/custom/products/search', 'GET', 'Search products by name, category, or SKU', 'active', false, 3000),
      ('Webhook Ingest', '/custom/webhooks/ingest', 'POST', 'Ingest incoming webhook payloads', 'active', true, 1000),
      ('Health Check', '/custom/health', 'GET', 'Service health and status endpoint', 'active', false, 5000),
      ('Metrics Export', '/custom/metrics', 'GET', 'Export system metrics in Prometheus format', 'active', true, 100),
      ('Bulk Import', '/custom/import', 'POST', 'Bulk import records via file upload', 'active', true, 10),
      ('Report Generate', '/custom/reports/generate', 'POST', 'Generate a custom report', 'active', true, 20),
      ('Config Fetch', '/custom/config', 'GET', 'Fetch current system configuration', 'active', true, 500),
      ('Auth Token Refresh', '/custom/auth/refresh', 'POST', 'Refresh authentication token', 'active', true, 100),
      ('Data Export', '/custom/export/:format', 'GET', 'Export data in specified format (csv, json, xml)', 'inactive', true, 50)
    `);
    console.log('  Endpoints seeded (15 rows)');

    // Seed Schedules
    await client.query(`
      INSERT INTO schedules (name, workflow_id, cron_expression, description, status, last_run, next_run, timezone) VALUES
      ('Customer Sync - Every 30min', 1, '*/30 * * * *', 'Sync customer data every 30 minutes', 'active', NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '30 minutes', 'UTC'),
      ('Daily Invoice Generation', 3, '0 6 * * *', 'Generate invoices every morning at 6 AM', 'active', NOW() - INTERVAL '18 hours', NOW() + INTERVAL '6 hours', 'America/New_York'),
      ('Hourly Data Backup', 6, '0 * * * *', 'Backup critical data every hour', 'active', NOW() - INTERVAL '1 hour', NOW(), 'UTC'),
      ('Log Aggregation - 10min', 7, '*/10 * * * *', 'Aggregate logs every 10 minutes', 'active', NOW() - INTERVAL '10 minutes', NOW() + INTERVAL '10 minutes', 'UTC'),
      ('Weekly Payment Reconciliation', 8, '0 2 * * 1', 'Reconcile payments every Monday at 2 AM', 'paused', NOW() - INTERVAL '9 days', NOW() + INTERVAL '5 days', 'America/Chicago'),
      ('API Health Check - 5min', 10, '*/5 * * * *', 'Check API health every 5 minutes', 'active', NOW() - INTERVAL '5 minutes', NOW() + INTERVAL '5 minutes', 'UTC'),
      ('Nightly ETL Pipeline', 11, '0 1 * * *', 'Run ETL pipeline every night at 1 AM', 'active', NOW() - INTERVAL '23 hours', NOW() + INTERVAL '1 hour', 'America/Los_Angeles'),
      ('Monthly Compliance Report', 12, '0 0 1 * *', 'Generate compliance reports on the 1st of each month', 'active', NOW() - INTERVAL '14 days', NOW() + INTERVAL '16 days', 'UTC'),
      ('Churn Analysis - Daily', 14, '0 3 * * *', 'Run churn detection analysis daily at 3 AM', 'active', NOW() - INTERVAL '21 hours', NOW() + INTERVAL '3 hours', 'UTC'),
      ('File Import Check - 15min', 15, '*/15 * * * *', 'Check for new files to import every 15 minutes', 'active', NOW() - INTERVAL '15 minutes', NOW() + INTERVAL '15 minutes', 'UTC'),
      ('Cache Warmup - Hourly', NULL, '0 * * * *', 'Warm up cache with frequently accessed data', 'active', NOW() - INTERVAL '1 hour', NOW(), 'UTC'),
      ('Stale Data Cleanup', NULL, '0 4 * * 0', 'Clean up stale records every Sunday at 4 AM', 'active', NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', 'UTC'),
      ('Email Campaign Sync', 9, '0 */2 * * *', 'Sync email campaign data every 2 hours', 'active', NOW() - INTERVAL '2 hours', NOW(), 'Europe/London'),
      ('Database Vacuum', NULL, '0 5 * * *', 'Run database vacuum and analyze daily', 'active', NOW() - INTERVAL '19 hours', NOW() + INTERVAL '5 hours', 'UTC'),
      ('SSL Certificate Check', NULL, '0 8 * * 1', 'Check SSL certificate expiration weekly', 'active', NOW() - INTERVAL '6 days', NOW() + INTERVAL '1 day', 'UTC')
    `);
    console.log('  Schedules seeded (15 rows)');

    // Seed Logs
    await client.query(`
      INSERT INTO logs (action, resource_type, resource_id, user_id, details, level, ip_address, created_at) VALUES
      ('create', 'connection', 1, 1, 'Created Salesforce Production connection', 'info', '192.168.1.100', NOW() - INTERVAL '7 days'),
      ('update', 'workflow', 1, 2, 'Updated Customer Sync Pipeline trigger schedule', 'info', '192.168.1.101', NOW() - INTERVAL '6 days'),
      ('login', 'user', 1, 1, 'Admin user logged in successfully', 'info', '192.168.1.100', NOW() - INTERVAL '5 days'),
      ('error', 'connection', 11, NULL, 'Oracle Database connection timeout after 30s', 'error', '10.0.0.50', NOW() - INTERVAL '4 days'),
      ('delete', 'api', 10, 5, 'Deprecated shipping rates API removed', 'warning', '192.168.1.105', NOW() - INTERVAL '3 days'),
      ('create', 'transformation', 13, 6, 'Created JSON Schema Validator transformation', 'info', '192.168.1.106', NOW() - INTERVAL '2 days'),
      ('update', 'settings', 3, 1, 'Updated rate limit configuration', 'info', '192.168.1.100', NOW() - INTERVAL '1 day'),
      ('error', 'workflow', 14, NULL, 'Churn Detection workflow failed: model timeout', 'error', '10.0.0.51', NOW() - INTERVAL '18 hours'),
      ('create', 'webhook', 5, 3, 'Created deployment notification webhook', 'info', '192.168.1.103', NOW() - INTERVAL '12 hours'),
      ('login', 'user', 5, 5, 'James Kim logged in from new device', 'warning', '203.0.113.50', NOW() - INTERVAL '8 hours'),
      ('update', 'connector', 1, 2, 'Updated Salesforce connector to v2.5.0', 'info', '192.168.1.101', NOW() - INTERVAL '6 hours'),
      ('debug', 'workflow', 2, NULL, 'Order Processing Flow step 3 execution details', 'debug', '10.0.0.52', NOW() - INTERVAL '4 hours'),
      ('create', 'alert', 7, 1, 'Created high CPU usage alert rule', 'info', '192.168.1.100', NOW() - INTERVAL '2 hours'),
      ('error', 'api', 6, NULL, 'Payment API rate limit exceeded', 'error', '10.0.0.53', NOW() - INTERVAL '1 hour'),
      ('update', 'schedule', 1, 2, 'Modified customer sync schedule to every 30 min', 'info', '192.168.1.101', NOW() - INTERVAL '30 minutes')
    `);
    console.log('  Logs seeded (15 rows)');

    // Seed Alerts
    await client.query(`
      INSERT INTO alerts (name, condition, threshold, channel, status, severity, last_triggered) VALUES
      ('High Error Rate', 'error_rate > threshold', '5%', 'slack', 'active', 'critical', NOW() - INTERVAL '2 hours'),
      ('API Latency Warning', 'avg_response_time > threshold', '2000ms', 'email', 'active', 'high', NOW() - INTERVAL '1 day'),
      ('Low Disk Space', 'disk_usage > threshold', '85%', 'slack', 'active', 'high', NOW() - INTERVAL '3 days'),
      ('Connection Failure', 'connection_status = error', '1', 'slack', 'triggered', 'critical', NOW() - INTERVAL '4 hours'),
      ('Workflow Failure', 'workflow_status = error', '1', 'email', 'active', 'high', NOW() - INTERVAL '1 day'),
      ('Rate Limit Approaching', 'request_count > threshold', '80%', 'webhook', 'active', 'medium', NOW() - INTERVAL '6 hours'),
      ('High CPU Usage', 'cpu_usage > threshold', '90%', 'slack', 'active', 'high', NULL),
      ('Memory Usage Warning', 'memory_usage > threshold', '80%', 'email', 'active', 'medium', NOW() - INTERVAL '12 hours'),
      ('SSL Certificate Expiry', 'days_until_expiry < threshold', '30 days', 'email', 'active', 'medium', NULL),
      ('Unusual Login Activity', 'failed_logins > threshold', '5', 'sms', 'active', 'critical', NOW() - INTERVAL '5 days'),
      ('Database Connection Pool', 'pool_usage > threshold', '90%', 'slack', 'active', 'high', NOW() - INTERVAL '2 days'),
      ('Stale Data Warning', 'last_sync_age > threshold', '24 hours', 'email', 'muted', 'low', NOW() - INTERVAL '7 days'),
      ('Queue Backlog', 'queue_size > threshold', '1000', 'slack', 'active', 'medium', NOW() - INTERVAL '3 hours'),
      ('Payment Failure Spike', 'payment_failure_rate > threshold', '2%', 'sms', 'active', 'critical', NOW() - INTERVAL '1 hour'),
      ('Backup Failure', 'backup_status = failed', '1', 'email', 'active', 'high', NULL)
    `);
    console.log('  Alerts seeded (15 rows)');

    // Seed Webhooks
    await client.query(`
      INSERT INTO webhooks (name, url, events, secret, status, retry_count, last_triggered, description) VALUES
      ('Deployment Notifier', 'https://hooks.slack.com/services/T00/B00/deploy', 'deployment.success,deployment.failure', 'whsec_deploy123', 'active', 3, NOW() - INTERVAL '2 hours', 'Notify Slack on deployment events'),
      ('Order Status Update', 'https://partner.api.com/webhooks/orders', 'order.created,order.updated,order.shipped', 'whsec_order456', 'active', 5, NOW() - INTERVAL '10 minutes', 'Send order updates to partner system'),
      ('Customer Sync Trigger', 'https://internal.api.com/sync/trigger', 'customer.created,customer.updated', 'whsec_sync789', 'active', 3, NOW() - INTERVAL '30 minutes', 'Trigger customer data sync on changes'),
      ('Error Alert Webhook', 'https://alerting.company.com/ingest', 'error.critical,error.warning', 'whsec_alert012', 'active', 5, NOW() - INTERVAL '1 hour', 'Forward critical errors to alerting system'),
      ('Invoice Generated', 'https://accounting.company.com/hooks', 'invoice.created,invoice.sent', 'whsec_inv345', 'active', 3, NOW() - INTERVAL '6 hours', 'Notify accounting of new invoices'),
      ('User Activity Logger', 'https://analytics.company.com/events', 'user.login,user.logout,user.action', 'whsec_log678', 'active', 2, NOW() - INTERVAL '5 minutes', 'Log user activities to analytics platform'),
      ('Inventory Alert', 'https://warehouse.api.com/alerts', 'inventory.low,inventory.restock', 'whsec_inv901', 'active', 3, NOW() - INTERVAL '3 hours', 'Alert warehouse on low inventory'),
      ('CI/CD Pipeline Hook', 'https://ci.company.com/hooks/github', 'push,pull_request,release', 'whsec_cicd234', 'active', 3, NOW() - INTERVAL '1 day', 'Trigger CI/CD on GitHub events'),
      ('Payment Processor', 'https://payments.company.com/hooks', 'payment.success,payment.failed,refund', 'whsec_pay567', 'active', 5, NOW() - INTERVAL '15 minutes', 'Process payment events'),
      ('CRM Update Hook', 'https://crm.company.com/webhooks', 'lead.created,deal.closed,contact.updated', 'whsec_crm890', 'inactive', 3, NOW() - INTERVAL '7 days', 'Sync events to CRM - currently disabled'),
      ('Monitoring Heartbeat', 'https://uptime.company.com/ping', 'health.check', 'whsec_hb123', 'active', 1, NOW() - INTERVAL '5 minutes', 'Send heartbeat to uptime monitoring'),
      ('Report Generator', 'https://reports.company.com/trigger', 'report.requested,report.completed', 'whsec_rpt456', 'active', 3, NOW() - INTERVAL '12 hours', 'Trigger report generation'),
      ('Compliance Logger', 'https://compliance.company.com/events', 'data.access,data.export,config.change', 'whsec_comp789', 'active', 5, NOW() - INTERVAL '2 hours', 'Log compliance-relevant events'),
      ('Email Sender Hook', 'https://email.company.com/send', 'notification.email,digest.daily', 'whsec_email012', 'active', 3, NOW() - INTERVAL '8 hours', 'Trigger email sending service'),
      ('Backup Completion', 'https://ops.company.com/backup/status', 'backup.started,backup.completed,backup.failed', 'whsec_bkp345', 'active', 3, NOW() - INTERVAL '12 hours', 'Notify ops team of backup status')
    `);
    console.log('  Webhooks seeded (15 rows)');

    // Seed Templates
    await client.query(`
      INSERT INTO templates (name, description, category, complexity, estimated_time, steps_count, downloads, rating) VALUES
      ('Salesforce to Database Sync', 'Complete template for syncing Salesforce contacts to a PostgreSQL database', 'CRM Integration', 'intermediate', '30 minutes', 5, 2450, 4.70),
      ('REST API to CSV Export', 'Fetch data from REST API and export to CSV files', 'Data Export', 'beginner', '15 minutes', 3, 3200, 4.50),
      ('SAP Order Integration', 'End-to-end SAP order processing with error handling and retry', 'ERP Integration', 'advanced', '2 hours', 8, 890, 4.80),
      ('Webhook Event Router', 'Route incoming webhook events to different processing pipelines', 'Event Processing', 'intermediate', '45 minutes', 4, 1800, 4.30),
      ('Email Notification Pipeline', 'Automated email notifications triggered by system events', 'Notification', 'beginner', '20 minutes', 3, 4100, 4.60),
      ('Database Migration Template', 'Migrate data between databases with transformation and validation', 'Database', 'advanced', '3 hours', 7, 670, 4.40),
      ('API Gateway Setup', 'Configure API gateway with authentication, rate limiting, and logging', 'API Management', 'intermediate', '1 hour', 5, 1560, 4.50),
      ('Slack Alert Integration', 'Send formatted alerts and notifications to Slack channels', 'Messaging', 'beginner', '10 minutes', 2, 5200, 4.80),
      ('ETL Pipeline Template', 'Extract, transform, and load data with scheduling and monitoring', 'Data Pipeline', 'advanced', '4 hours', 10, 1200, 4.90),
      ('OAuth2 Connection Setup', 'Template for setting up OAuth2-authenticated connections', 'Authentication', 'intermediate', '30 minutes', 4, 2800, 4.20),
      ('File Processing Pipeline', 'Watch for new files, process, transform, and load into database', 'File Processing', 'intermediate', '45 minutes', 5, 1400, 4.30),
      ('Multi-System Data Merge', 'Merge data from multiple systems into unified dataset', 'Data Integration', 'advanced', '2 hours', 6, 950, 4.60),
      ('Health Check Dashboard', 'Monitor and display health status of all integrations', 'Monitoring', 'beginner', '15 minutes', 3, 3800, 4.70),
      ('Batch Processing Template', 'Process large datasets in configurable batch sizes', 'Data Processing', 'intermediate', '1 hour', 5, 1100, 4.40),
      ('Error Recovery Workflow', 'Automated error detection, logging, retry, and escalation', 'Error Handling', 'advanced', '1.5 hours', 6, 2100, 4.80)
    `);
    console.log('  Templates seeded (15 rows)');

    // Seed Settings
    await client.query(`
      INSERT INTO settings (key, value, category, description, is_secret, updated_by) VALUES
      ('app_name', 'System Integrator', 'general', 'Application display name', false, 1),
      ('app_version', '2.1.0', 'general', 'Current application version', false, 1),
      ('max_connections', '100', 'performance', 'Maximum concurrent database connections', false, 1),
      ('request_timeout', '30000', 'performance', 'Default request timeout in milliseconds', false, 1),
      ('jwt_expiry', '24h', 'security', 'JWT token expiration duration', false, 1),
      ('password_min_length', '8', 'security', 'Minimum password length requirement', false, 1),
      ('rate_limit_window', '60000', 'performance', 'Rate limit window in milliseconds', false, 1),
      ('rate_limit_max', '100', 'performance', 'Maximum requests per rate limit window', false, 1),
      ('smtp_host', 'smtp.company.com', 'notification', 'SMTP server hostname for email notifications', false, 1),
      ('smtp_port', '587', 'notification', 'SMTP server port', false, 1),
      ('smtp_password', '********', 'notification', 'SMTP server password', true, 1),
      ('slack_webhook_url', 'https://hooks.slack.com/services/xxx', 'notification', 'Default Slack webhook URL for notifications', true, 1),
      ('api_key_rotation_days', '90', 'security', 'Number of days before API keys should be rotated', false, 1),
      ('default_retry_count', '3', 'integration', 'Default number of retries for failed integrations', false, 1),
      ('log_retention_days', '90', 'general', 'Number of days to retain log entries', false, 1),
      ('webhook_timeout', '10000', 'integration', 'Webhook delivery timeout in milliseconds', false, 1)
    `);
    console.log('  Settings seeded (16 rows)');

    // Seed Error Retries
    await client.query(`
      INSERT INTO error_retries (name, max_retries, backoff_strategy, delay_ms, description, status, applied_to) VALUES
      ('API Default Retry', 3, 'exponential', 1000, 'Default retry policy for API calls with exponential backoff', 'active', 'apis'),
      ('Database Reconnect', 5, 'exponential', 2000, 'Retry database connections with increasing delay', 'active', 'connections'),
      ('Webhook Delivery', 5, 'exponential', 5000, 'Retry failed webhook deliveries', 'active', 'webhooks'),
      ('File Transfer Retry', 3, 'linear', 10000, 'Retry file transfers with fixed 10s intervals', 'active', 'connections'),
      ('Payment Processing', 2, 'fixed', 30000, 'Conservative retry for payment operations', 'active', 'workflows'),
      ('Email Send Retry', 3, 'exponential', 3000, 'Retry failed email deliveries', 'active', 'notifications'),
      ('Sync Operation Retry', 4, 'exponential', 5000, 'Retry sync operations between systems', 'active', 'workflows'),
      ('Cache Refresh', 2, 'fixed', 1000, 'Quick retry for cache operations', 'active', 'settings'),
      ('Search Index Retry', 3, 'linear', 5000, 'Retry search index updates', 'active', 'apis'),
      ('Batch Processing', 3, 'exponential', 15000, 'Retry batch processing jobs with longer delays', 'active', 'workflows'),
      ('OAuth Token Refresh', 2, 'fixed', 2000, 'Retry OAuth token refresh requests', 'active', 'connections'),
      ('Queue Message Retry', 5, 'exponential', 1000, 'Retry failed queue message processing', 'active', 'workflows'),
      ('Report Generation', 2, 'linear', 30000, 'Retry report generation with 30s delay', 'active', 'workflows'),
      ('Legacy System Call', 5, 'exponential', 10000, 'Extended retry for slow legacy system calls', 'active', 'connections'),
      ('Health Check Retry', 3, 'fixed', 5000, 'Retry health check pings on failure', 'inactive', 'endpoints')
    `);
    console.log('  Error retries seeded (15 rows)');

    console.log('\nSeeding completed successfully!');
  } catch (err) {
    console.error('Seeding error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
