import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AIOutput from '../components/AIOutput';
import api from '../api/axios';

const AI_FEATURES = [
  {
    key: 'mapping',
    label: 'Generate Mapping',
    icon: '🗺️',
    endpoint: '/ai/generate-mapping',
    description: 'Generate field mappings between source and target schemas',
    fields: [
      { key: 'sourceSchema', label: 'Source Schema (JSON)', type: 'textarea', placeholder: '{"id": "number", "name": "string", ...}' },
      { key: 'targetSchema', label: 'Target Schema (JSON)', type: 'textarea', placeholder: '{"userId": "number", "fullName": "string", ...}' },
      { key: 'context', label: 'Additional Context', type: 'textarea', placeholder: 'Describe any special mapping rules...' },
    ],
  },
  {
    key: 'error',
    label: 'Analyze Error',
    icon: '🔍',
    endpoint: '/ai/analyze-error',
    description: 'Analyze integration errors and get resolution suggestions',
    fields: [
      { key: 'error', label: 'Error Message', type: 'textarea', placeholder: 'Paste the error message or stack trace...' },
      { key: 'context', label: 'Context', type: 'textarea', placeholder: 'What was happening when the error occurred?' },
    ],
  },
  {
    key: 'workflow',
    label: 'Suggest Workflow',
    icon: '⚡',
    endpoint: '/ai/suggest-workflow',
    description: 'Get AI-generated workflow suggestions for your integration needs',
    fields: [
      { key: 'description', label: 'Describe Your Integration', type: 'textarea', placeholder: 'I need to sync data from Salesforce to our PostgreSQL database every hour...' },
      { key: 'constraints', label: 'Constraints', type: 'textarea', placeholder: 'Any specific requirements or limitations?' },
    ],
  },
  {
    key: 'transformation',
    label: 'Generate Transformation',
    icon: '🔄',
    endpoint: '/ai/generate-transformation',
    description: 'Generate data transformation code or rules',
    fields: [
      { key: 'sourceFormat', label: 'Source Format', type: 'select', options: ['JSON', 'XML', 'CSV', 'YAML'] },
      { key: 'targetFormat', label: 'Target Format', type: 'select', options: ['JSON', 'XML', 'CSV', 'YAML'] },
      { key: 'sampleData', label: 'Sample Data', type: 'textarea', placeholder: 'Paste a sample of your source data...' },
      { key: 'requirements', label: 'Requirements', type: 'textarea', placeholder: 'Describe the transformation rules...' },
    ],
  },
  {
    key: 'chat',
    label: 'General Chat',
    icon: '💬',
    endpoint: '/ai/chat',
    description: 'Ask anything about system integration',
    fields: [
      { key: 'message', label: 'Your Message', type: 'textarea', placeholder: 'Ask anything about integrations, APIs, data pipelines...' },
    ],
  },
];

export default function AIAssistant() {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(AI_FEATURES[0]);
  const [formData, setFormData] = useState({});
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const responsesEndRef = useRef(null);

  useEffect(() => {
    if (responsesEndRef.current) {
      responsesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [responses, loading]);

  const handleFieldChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasInput = activeFeature.fields.some((f) => formData[f.key]?.trim());
    if (!hasInput) return;

    const userMessage = activeFeature.fields
      .filter((f) => formData[f.key])
      .map((f) => `**${f.label}:** ${formData[f.key]}`)
      .join('\n\n');

    setResponses((prev) => [
      ...prev,
      { type: 'user', feature: activeFeature.label, content: userMessage, timestamp: new Date() },
    ]);
    setLoading(true);

    try {
      const res = await api.post(activeFeature.endpoint, formData);
      const data = res.data;
      let content = '';

      if (typeof data === 'string') {
        content = data;
      } else if (data.result) {
        content = data.result;
      } else if (data.response) {
        content = data.response;
      } else if (data.message) {
        content = data.message;
      } else if (data.data) {
        content = typeof data.data === 'string' ? data.data : data.data;
      } else {
        content = data;
      }

      setResponses((prev) => [
        ...prev,
        { type: 'ai', feature: activeFeature.label, content, timestamp: new Date() },
      ]);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to get AI response. Please try again.';
      setResponses((prev) => [
        ...prev,
        { type: 'error', feature: activeFeature.label, content: errMsg, timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
      setFormData({});
    }
  };

  const switchFeature = (feat) => {
    setActiveFeature(feat);
    setFormData({});
  };

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
                <span className="page-icon">🤖</span> AI Assistant
              </h2>
              <p className="page-subtitle">Intelligent integration assistance powered by AI</p>
            </div>
          </div>
        </div>

        <div className="ai-layout">
          <div className="ai-sidebar">
            <h3 className="ai-sidebar-title">AI Features</h3>
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
              {responses.length === 0 && !loading && (
                <div className="ai-welcome">
                  <div className="ai-welcome-icon">🤖</div>
                  <h3>Welcome to AI Assistant</h3>
                  <p>Select a feature from the sidebar and provide your input to get started. I can help you generate mappings, analyze errors, suggest workflows, and more.</p>
                </div>
              )}

              {responses.map((resp, i) => (
                <div key={i} className={`ai-message ai-message-${resp.type}`}>
                  <div className="ai-message-header">
                    <span className="ai-message-avatar">
                      {resp.type === 'user' ? '👤' : resp.type === 'error' ? '⚠️' : '🤖'}
                    </span>
                    <span className="ai-message-sender">
                      {resp.type === 'user' ? 'You' : resp.type === 'error' ? 'Error' : 'AI Assistant'}
                    </span>
                    <span className="ai-message-badge">{resp.feature}</span>
                    <span className="ai-message-time">
                      {resp.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="ai-message-body">
                    {resp.type === 'user' ? (
                      <div className="ai-user-content">
                        {resp.content.split('\n\n').map((line, j) => {
                          const parts = line.match(/^\*\*(.+?):\*\*\s(.+)$/s);
                          if (parts) {
                            return (
                              <div key={j} className="ai-user-field">
                                <span className="ai-user-label">{parts[1]}</span>
                                <span className="ai-user-value">{parts[2]}</span>
                              </div>
                            );
                          }
                          return <p key={j}>{line}</p>;
                        })}
                      </div>
                    ) : resp.type === 'error' ? (
                      <div className="ai-error-content">{resp.content}</div>
                    ) : (
                      <AIOutput content={resp.content} />
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="ai-message ai-message-ai">
                  <div className="ai-message-header">
                    <span className="ai-message-avatar">🤖</span>
                    <span className="ai-message-sender">AI Assistant</span>
                  </div>
                  <div className="ai-message-body">
                    <AIOutput isLoading={true} />
                  </div>
                </div>
              )}

              <div ref={responsesEndRef} />
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
                      {field.type === 'select' ? (
                        <select
                          className="form-input"
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        >
                          <option value="">Select...</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <textarea
                          className="form-input ai-textarea"
                          value={formData[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          placeholder={field.placeholder || ''}
                          rows={field.key === 'message' ? 3 : 2}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <button type="submit" className="btn btn-primary btn-send" disabled={loading}>
                  {loading ? (
                    <span className="btn-loading"><span className="spinner" /> Processing...</span>
                  ) : (
                    <>Send →</>
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
