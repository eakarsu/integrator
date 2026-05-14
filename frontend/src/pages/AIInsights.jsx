import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AIOutput from '../components/AIOutput';
import api from '../api/axios';

const AI_FEATURES = [
  {
    key: 'discover',
    label: 'Discover Connectors',
    icon: '🔌',
    endpoint: '/ai/discover-connectors',
    description: 'Suggest connectors and stack gaps for your tech stack',
    fields: [
      { key: 'tech_stack', label: 'Tech Stack', placeholder: 'e.g. Postgres, Salesforce, AWS S3' },
      { key: 'integration_goals', label: 'Integration Goals', placeholder: 'e.g. nightly sync of accounts to warehouse' },
      { key: 'existing_connectors', label: 'Existing Connectors (CSV or JSON)', placeholder: 'salesforce, snowflake' },
    ],
  },
  {
    key: 'anomaly',
    label: 'Detect Flow Anomalies',
    icon: '⚠️',
    endpoint: '/ai/detect-flow-anomalies',
    description: 'Compare recent vs baseline metrics to surface anomalies',
    fields: [
      { key: 'workflow_id', label: 'Workflow ID', placeholder: 'wf-1234' },
      { key: 'recent_metrics', label: 'Recent Metrics (JSON)', placeholder: '{"latency_ms":420,"error_rate":0.03}' },
      { key: 'baseline_metrics', label: 'Baseline Metrics (JSON)', placeholder: '{"latency_ms":150,"error_rate":0.005}' },
      { key: 'lookback', label: 'Lookback (e.g. 24h)', placeholder: '24h' },
    ],
  },
  {
    key: 'cost',
    label: 'Optimize Cost',
    icon: '💰',
    endpoint: '/ai/optimize-cost',
    description: 'Identify high-latency / redundant transformations',
    fields: [
      { key: 'workflows', label: 'Workflows (JSON array)', placeholder: '[{"id":"wf-1","steps":12}]' },
      { key: 'transformations', label: 'Transformations (JSON array)', placeholder: '[{"id":"t1","avg_ms":230}]' },
      { key: 'sample_traces', label: 'Sample Traces (JSON array)', placeholder: '[{"trace_id":"abc","duration_ms":3000}]' },
    ],
  },
  {
    key: 'dq-rules',
    label: 'Data Quality Rules',
    icon: '🧪',
    endpoint: '/ai/data-quality-rules',
    description: 'Generate machine-checkable DQ rules from a schema and samples',
    fields: [
      { key: 'schema', label: 'Schema (JSON)', placeholder: '{"id":"int","email":"string","created_at":"timestamp"}' },
      { key: 'sample_records', label: 'Sample Records (JSON array)', placeholder: '[{"id":1,"email":"a@b.com"}]' },
      { key: 'business_rules', label: 'Business Rules (JSON array)', placeholder: '["email must be unique","created_at <= now"]' },
      { key: 'severity_thresholds', label: 'Severity Thresholds (JSON)', placeholder: '{"critical_pct":1,"high_pct":5}' },
    ],
  },
  {
    key: 'schema-align',
    label: 'Schema Alignment',
    icon: '🧩',
    endpoint: '/ai/schema-alignment',
    description: 'Align multiple source schemas (CSV/JSON/Avro/Parquet) onto a canonical IR',
    fields: [
      { key: 'schemas', label: 'Schemas (JSON array of 2+)', placeholder: '[{"name":"src_a","fields":[...]}, {"name":"src_b","fields":[...]}]' },
      { key: 'canonical_target', label: 'Canonical Target (optional)', placeholder: 'JSON Schema' },
      { key: 'alignment_goals', label: 'Alignment Goals (JSON or text)', placeholder: '"unify customer profile across sources"' },
    ],
  },
];

function maybeJSON(value) {
  if (!value) return value;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // pass as-is; backend will handle
    }
  }
  return trimmed;
}

export default function AIInsights() {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(AI_FEATURES[0]);
  const [formData, setFormData] = useState({});
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchFeature = (feat) => {
    setActiveFeature(feat);
    setFormData({});
    setResponse(null);
    setError('');
  };

  const handleFieldChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResponse(null);
    setError('');

    const hasInput = activeFeature.fields.some((f) => formData[f.key]?.trim?.());
    if (!hasInput) {
      setError('Please fill in at least one field.');
      return;
    }

    const payload = {};
    for (const f of activeFeature.fields) {
      const v = formData[f.key];
      if (v === undefined || v === null || v === '') continue;
      payload[f.key] = maybeJSON(v);
    }

    setLoading(true);
    try {
      const res = await api.post(activeFeature.endpoint, payload);
      setResponse(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  let aiContent = '';
  if (response) {
    if (typeof response === 'string') aiContent = response;
    else if (response.result && typeof response.result === 'string') aiContent = response.result;
    else if (response.response && typeof response.response === 'string') aiContent = response.response;
    else aiContent = '```json\n' + JSON.stringify(response, null, 2) + '\n```';
  }

  return (
    <Layout>
      <div className="ai-page">
        <div className="page-header">
          <div className="page-header-left">
            <button className="btn-back" onClick={() => navigate('/')}>
              ← Back
            </button>
            <div>
              <h2 className="page-title">
                <span className="page-icon">🧠</span> AI Insights
              </h2>
              <p className="page-subtitle">Discover connectors, detect flow anomalies, optimize cost</p>
            </div>
          </div>
        </div>

        <div className="ai-layout">
          <div className="ai-sidebar">
            <h3 className="ai-sidebar-title">AI Insights</h3>
            {AI_FEATURES.map((feat) => (
              <button
                key={feat.key}
                className={`ai-feature-btn ${activeFeature.key === feat.key ? 'active' : ''}`}
                onClick={() => switchFeature(feat)}
              >
                <span className="ai-feature-icon">{feat.icon}</span>
                <div className="ai-feature-info">
                  <span className="ai-feature-label">{feat.label}</span>
                  <span className="ai-feature-desc">{feat.description}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="ai-main">
            <div className="ai-responses">
              {!response && !loading && !error && (
                <div className="ai-welcome">
                  <div className="ai-welcome-icon">🧠</div>
                  <h3>{activeFeature.label}</h3>
                  <p>{activeFeature.description}</p>
                  <p style={{ marginTop: 12, fontSize: 13, opacity: 0.7 }}>
                    Fill the fields below and submit to get an AI-generated response.
                  </p>
                </div>
              )}

              {error && (
                <div className="ai-message ai-message-error">
                  <div className="ai-message-header">
                    <span className="ai-message-avatar">⚠️</span>
                    <span className="ai-message-sender">Error</span>
                    <span className="ai-message-badge">{activeFeature.label}</span>
                  </div>
                  <div className="ai-message-body">
                    <div className="ai-error-content">{error}</div>
                  </div>
                </div>
              )}

              {loading && (
                <div className="ai-message ai-message-ai">
                  <div className="ai-message-header">
                    <span className="ai-message-avatar">🤖</span>
                    <span className="ai-message-sender">AI Insights</span>
                  </div>
                  <div className="ai-message-body">
                    <AIOutput isLoading={true} />
                  </div>
                </div>
              )}

              {!loading && response && (
                <div className="ai-message ai-message-ai">
                  <div className="ai-message-header">
                    <span className="ai-message-avatar">🤖</span>
                    <span className="ai-message-sender">AI Insights</span>
                    <span className="ai-message-badge">{activeFeature.label}</span>
                  </div>
                  <div className="ai-message-body">
                    <AIOutput content={aiContent} />
                  </div>
                </div>
              )}
            </div>

            <div className="ai-input-area">
              <div className="ai-input-header">
                <span className="ai-input-feature-icon">{activeFeature.icon}</span>
                <span className="ai-input-feature-name">{activeFeature.label}</span>
              </div>
              <form className="ai-form" onSubmit={handleSubmit}>
                <div className="ai-form-fields">
                  {activeFeature.fields.map((field) => (
                    <div key={field.key} className="ai-form-group">
                      <label className="form-label">{field.label}</label>
                      <textarea
                        className="form-input ai-textarea"
                        value={formData[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder || ''}
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
                <button type="submit" className="btn btn-primary btn-send" disabled={loading}>
                  {loading ? (
                    <span className="btn-loading"><span className="spinner" /> Processing...</span>
                  ) : (
                    <>Run →</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
