ALTER TABLE users
  ADD CONSTRAINT users_tenant_id_id_unique UNIQUE (tenant_id, id),
  ADD CONSTRAINT users_created_by_same_tenant
    FOREIGN KEY (tenant_id, created_by) REFERENCES users (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE connections
  ADD CONSTRAINT connections_tenant_id_id_unique UNIQUE (tenant_id, id),
  ADD CONSTRAINT connections_creator_same_tenant
    FOREIGN KEY (tenant_id, created_by) REFERENCES users (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE workflows
  ADD CONSTRAINT workflows_tenant_id_id_unique UNIQUE (tenant_id, id),
  ADD CONSTRAINT workflows_creator_same_tenant
    FOREIGN KEY (tenant_id, created_by) REFERENCES users (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE workflow_runs
  ADD COLUMN workflow_version INTEGER,
  ADD COLUMN workflow_definition JSONB,
  ADD COLUMN max_attempts INTEGER,
  ADD COLUMN retry_delay_ms INTEGER;

UPDATE workflow_runs AS run
   SET workflow_version = workflow.version,
       workflow_definition = workflow.definition,
       max_attempts = workflow.max_attempts,
       retry_delay_ms = workflow.retry_delay_ms
  FROM workflows AS workflow
 WHERE workflow.id = run.workflow_id
   AND workflow.tenant_id = run.tenant_id;

ALTER TABLE workflow_runs
  ALTER COLUMN workflow_version SET NOT NULL,
  ALTER COLUMN workflow_definition SET NOT NULL,
  ALTER COLUMN max_attempts SET NOT NULL,
  ALTER COLUMN retry_delay_ms SET NOT NULL,
  ADD CONSTRAINT workflow_runs_workflow_version_positive CHECK (workflow_version > 0),
  ADD CONSTRAINT workflow_runs_definition_object CHECK (jsonb_typeof(workflow_definition) = 'object'),
  ADD CONSTRAINT workflow_runs_max_attempts_range CHECK (max_attempts BETWEEN 1 AND 10),
  ADD CONSTRAINT workflow_runs_retry_delay_range CHECK (retry_delay_ms BETWEEN 100 AND 3600000),
  ADD CONSTRAINT workflow_runs_tenant_id_id_unique UNIQUE (tenant_id, id),
  ADD CONSTRAINT workflow_runs_workflow_same_tenant
    FOREIGN KEY (tenant_id, workflow_id) REFERENCES workflows (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT workflow_runs_requester_same_tenant
    FOREIGN KEY (tenant_id, requested_by) REFERENCES users (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE workflow_run_steps
  ADD CONSTRAINT workflow_run_steps_run_same_tenant
    FOREIGN KEY (tenant_id, run_id) REFERENCES workflow_runs (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_actor_same_tenant
    FOREIGN KEY (tenant_id, actor_id) REFERENCES users (tenant_id, id) ON DELETE RESTRICT;
