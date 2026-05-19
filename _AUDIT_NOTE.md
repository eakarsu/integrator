# Audit Apply Notes — integrator

Source: `_AUDIT/reports/batch_10.md` § Partial-builds #18 integrator

## Original audit recommendations

> 16 routes + 5 AI endpoints (`/generate-mapping`, `/analyze-error`, `/suggest-workflow`, `/generate-transformation`, `/chat`).

### What's missing
- Pre-built connector library (Salesforce, HubSpot, Stripe, etc.)
- Visual workflow builder
- Data quality monitoring
- Cost attribution per integration
- Audit logging
- Multi-tenant support

### Custom feature ideas
- AI-driven connector discovery
- Anomaly detection in data flows
- Cost optimizer (high-latency/redundant transformations)
- Visual builder with drag-drop + AI suggestions
- Multi-modal schema alignment (CSV, JSON, Avro, Parquet)

## Implemented this pass

All implemented in `backend/src/routes/ai.js`, mounted under `/api/ai`:

- `POST /api/ai/discover-connectors` — accepts `{ tech_stack, integration_goals, existing_connectors }`, returns strict JSON `{recommended_connectors[], stack_gaps[], rollout_order[]}`. Mechanical implementation of "AI-driven connector discovery".
- `POST /api/ai/detect-flow-anomalies` — accepts `{ workflow_id, recent_metrics, baseline_metrics, lookback }`, returns strict JSON `{anomalies[], overall_health, summary}`. Mechanical implementation of "Anomaly detection in data flows".
- `POST /api/ai/optimize-cost` — accepts `{ workflows, transformations, sample_traces }`, returns strict JSON `{recommendations[], estimated_total_savings_pct, warnings[]}`. Mechanical implementation of "Cost optimizer (identify high-latency/redundant transformations)".

All three reuse the existing `callOpenRouter` helper. Syntax-checked with `node --check`.

## Backlog (not implemented)

### Needs schema/data model work
- Pre-built connector library — connector registry table + per-connector schema.
- Audit logging — append-only audit log w/ tamper detection.
- Multi-tenant support — tenant scoping across all tables.
- Cost attribution — per-tenant + per-integration metering.

### Needs frontend work (forbidden this pass)
- Visual workflow builder (drag-drop UI).

### Needs product decision
- Data quality monitoring — define quality rules / SLA thresholds.
- Multi-modal schema alignment — pick canonical IR (Arrow / JSON Schema?).

## Categorisation

- MECHANICAL: discover-connectors, detect-flow-anomalies, optimize-cost (all done).
- NEEDS-SCHEMA: connector registry, audit log, multi-tenant, cost metering.
- NEEDS-FRONTEND: visual builder.
- NEEDS-PRODUCT-DECISION: DQ rules, canonical schema IR.

## Apply pass 3 (frontend)

LEFT-AS-IS. Frontend already wired: `frontend/src/api/axios.js` interceptor injects `Authorization: Bearer ${localStorage.token}` and redirects on 401, and `frontend/src/pages/AIInsights.jsx` (route `/ai-insights` in `App.jsx`) provides a sidebar-tabbed UI calling all three pass-2 endpoints (`/api/ai/discover-connectors`, `/api/ai/detect-flow-anomalies`, `/api/ai/optimize-cost`). Errors surface via `err.response?.data?.error` which captures the backend 503-no-key payload. No FE changes required.
