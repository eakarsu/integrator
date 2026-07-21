CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(320) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin','editor','viewer')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version > 0),
  created_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX users_tenant_idx ON users(tenant_id);

CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  connector_type VARCHAR(30) NOT NULL CHECK (connector_type IN ('http')),
  base_url TEXT NOT NULL CHECK (base_url ~ '^https?://'),
  encrypted_credentials BYTEA,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX connections_tenant_status_idx ON connections(tenant_id, status);

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  definition JSONB NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  retry_delay_ms INTEGER NOT NULL DEFAULT 1000 CHECK (retry_delay_ms BETWEEN 100 AND 3600000),
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX workflows_tenant_status_idx ON workflows(tenant_id, status);

CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE RESTRICT,
  requested_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(200) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('queued','running','retry_scheduled','succeeded','dead_letter','cancelled')),
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  error JSONB,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  retry_cycle INTEGER NOT NULL DEFAULT 0 CHECK (retry_cycle >= 0),
  next_attempt_at TIMESTAMPTZ,
  leased_by TEXT,
  lease_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, workflow_id, idempotency_key)
);
CREATE INDEX workflow_runs_claim_idx ON workflow_runs(status, next_attempt_at, lease_expires_at);
CREATE INDEX workflow_runs_tenant_workflow_idx ON workflow_runs(tenant_id, workflow_id, created_at DESC);

CREATE TABLE workflow_run_steps (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE RESTRICT,
  retry_cycle INTEGER NOT NULL CHECK (retry_cycle >= 0),
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  step_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running','succeeded','failed')),
  input JSONB,
  output JSONB,
  error JSONB,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (run_id, retry_cycle, attempt, step_index)
);
CREATE INDEX workflow_run_steps_tenant_run_idx ON workflow_run_steps(tenant_id, run_id);

CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  sequence BIGINT NOT NULL,
  actor_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL,
  previous_hash VARCHAR(64) NOT NULL,
  event_hash CHAR(64) NOT NULL,
  UNIQUE (tenant_id, sequence),
  UNIQUE (tenant_id, event_hash)
);
CREATE INDEX audit_events_resource_idx ON audit_events(tenant_id, resource_type, resource_id);

CREATE FUNCTION reject_audit_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are immutable';
END;
$$;

CREATE TRIGGER audit_events_no_update BEFORE UPDATE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER audit_events_no_delete BEFORE DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
