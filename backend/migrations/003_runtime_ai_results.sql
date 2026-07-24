CREATE TABLE runtime_ai_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  prompt TEXT NOT NULL,
  content TEXT NOT NULL,
  provider VARCHAR(30) NOT NULL,
  model VARCHAR(200) NOT NULL,
  provider_receipt JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX runtime_ai_results_identity_idx
  ON runtime_ai_results(tenant_id, user_id, created_at DESC);
