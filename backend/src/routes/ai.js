const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(systemPrompt, userMessage) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;

  if (!apiKey || apiKey === 'your-openrouter-api-key-here') {
    throw new Error('OPENROUTER_API_KEY is not configured. Please set it in the .env file.');
  }

  if (!model) {
    throw new Error('OPENROUTER_MODEL is not configured');
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'System Integrator',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// POST /api/ai/generate-mapping
// Frontend sends: { sourceSchema, targetSchema, context }
// After snake_case middleware: { source_schema, target_schema, context }
router.post('/generate-mapping', async (req, res) => {
  try {
    const { source_schema, target_schema, context } = req.body;

    if (!source_schema || !target_schema) {
      return res.status(400).json({ error: 'Source Schema and Target Schema are required' });
    }

    const systemPrompt = `You are an expert data integration architect specializing in data mapping between different systems and formats.
Your task is to generate accurate field mappings between source and target schemas.
Provide clear, well-formatted mappings with field-by-field correspondence and transformation rules where needed.
Use markdown formatting for readability.`;

    const userMessage = `Generate a data mapping between these schemas:

Source Schema:
${source_schema}

Target Schema:
${target_schema}

${context ? `Additional Context: ${context}` : ''}

Provide the mapping with source field, target field, transformation rule (if needed), and confidence level.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error generating mapping:', err);
    res.status(500).json({ error: err.message || 'Failed to generate mapping' });
  }
});

// POST /api/ai/analyze-error
// Frontend sends: { error, context }
// After snake_case middleware: { error, context }
router.post('/analyze-error', async (req, res) => {
  try {
    const { error: errorMsg, context } = req.body;

    if (!errorMsg) {
      return res.status(400).json({ error: 'Error message is required' });
    }

    const systemPrompt = `You are an expert integration error analyst. You specialize in diagnosing and resolving errors in system integrations, APIs, data pipelines, and middleware.
Analyze errors thoroughly and provide:
1. Root cause analysis
2. Impact assessment
3. Step-by-step resolution guide
4. Prevention recommendations
Be specific and actionable. Use markdown formatting.`;

    const userMessage = `Analyze this integration error:

Error: ${errorMsg}
${context ? `Context: ${context}` : ''}

Provide a detailed analysis with root cause, impact, resolution steps, and prevention tips.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error analyzing error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze error' });
  }
});

// POST /api/ai/suggest-workflow
// Frontend sends: { description, constraints }
// After snake_case middleware: { description, constraints }
router.post('/suggest-workflow', async (req, res) => {
  try {
    const { description, constraints } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const systemPrompt = `You are an expert workflow optimization consultant for system integrations.
You help design and optimize integration workflows for maximum efficiency, reliability, and maintainability.
Consider error handling, retry strategies, parallel processing, data validation, and monitoring.
Provide practical, implementable suggestions with clear reasoning. Use markdown formatting.`;

    const userMessage = `Suggest an integration workflow for:

Description: ${description}
${constraints ? `Constraints: ${constraints}` : ''}

Provide optimized workflow suggestions with steps, trigger recommendations, error handling, and expected improvements.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error suggesting workflow:', err);
    res.status(500).json({ error: err.message || 'Failed to suggest workflow' });
  }
});

// POST /api/ai/generate-transformation
// Frontend sends: { sourceFormat, targetFormat, sampleData, requirements }
// After snake_case middleware: { source_format, target_format, sample_data, requirements }
router.post('/generate-transformation', async (req, res) => {
  try {
    const { source_format, target_format, sample_data, requirements } = req.body;

    if (!source_format || !target_format) {
      return res.status(400).json({ error: 'Source format and target format are required' });
    }

    const systemPrompt = `You are an expert data transformation engineer. You write efficient, reliable data transformation code for integration pipelines.
Generate clean, well-documented transformation code that handles edge cases, null values, and data type conversions.
Use JavaScript/Node.js for the transformation code. Include input validation and error handling. Use markdown formatting with code blocks.`;

    const userMessage = `Generate transformation code:

Source Format: ${source_format}
Target Format: ${target_format}
${sample_data ? `Sample Data: ${sample_data}` : ''}
${requirements ? `Requirements: ${requirements}` : ''}

Provide complete transformation code with the function, input validation, error handling, and usage examples.`;

    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error generating transformation:', err);
    res.status(500).json({ error: err.message || 'Failed to generate transformation' });
  }
});

// POST /api/ai/chat
// Frontend sends: { message }
// After snake_case middleware: { message }
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemPrompt = `You are an AI assistant for a System Integrator platform. You help users with:
- Designing integration architectures
- Troubleshooting connection issues
- Writing API configurations
- Setting up data transformations and mappings
- Configuring workflows and schedules
- Best practices for system integration
- Error handling and retry strategies
- Security and authentication patterns

Be helpful, concise, and provide actionable advice. Use markdown formatting for readability.`;

    const result = await callOpenRouter(systemPrompt, message);
    res.json({ result });
  } catch (err) {
    console.error('Error in AI chat:', err);
    res.status(500).json({ error: err.message || 'Failed to process chat message' });
  }
});

// Audit-driven addition: "AI-driven connector discovery (suggest connectors based on user's tech stack)".
router.post('/discover-connectors', async (req, res) => {
  try {
    const { tech_stack, integration_goals, existing_connectors } = req.body;
    if (!tech_stack && !integration_goals) {
      return res.status(400).json({ error: 'tech_stack or integration_goals is required' });
    }
    const systemPrompt = `You are an integration platform advisor. Given a user's tech stack and integration goals, recommend connectors to build or enable. Respond with strict JSON only of the form: {"recommended_connectors": [{"name": <string>, "category": <string>, "priority": "high|medium|low", "reason": <string>, "data_volume_hint": <string>, "auth_type": <string>}], "stack_gaps": [<strings>], "rollout_order": [<connector names>]}.`;
    const userMessage = `Tech stack: ${JSON.stringify(tech_stack || null)}\nIntegration goals: ${JSON.stringify(integration_goals || null)}\nExisting connectors: ${JSON.stringify(existing_connectors || [])}`;
    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error in connector discovery:', err);
    res.status(500).json({ error: err.message || 'Failed to discover connectors' });
  }
});

// Audit-driven addition: "Anomaly detection in data flows (flag unexpected volume/pattern changes)".
router.post('/detect-flow-anomalies', async (req, res) => {
  try {
    const { workflow_id, recent_metrics, baseline_metrics, lookback } = req.body;
    if (!recent_metrics) {
      return res.status(400).json({ error: 'recent_metrics is required' });
    }
    const systemPrompt = `You are a data-flow observability analyst. Compare recent integration metrics against a baseline and flag anomalies. Respond with strict JSON only of the form: {"anomalies": [{"metric": <string>, "expected": <number-or-string>, "observed": <number-or-string>, "severity": "low|medium|high|critical", "likely_cause": <string>, "recommended_check": <string>}], "overall_health": "healthy|degraded|incident", "summary": <string>}.`;
    const userMessage = `Workflow: ${workflow_id || 'unspecified'}\nLookback: ${lookback || '24h'}\n\nRecent metrics:\n${JSON.stringify(recent_metrics, null, 2)}\n\nBaseline metrics:\n${JSON.stringify(baseline_metrics || null, null, 2)}`;
    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error detecting flow anomalies:', err);
    res.status(500).json({ error: err.message || 'Failed to detect flow anomalies' });
  }
});

// Audit-driven addition: "Cost optimizer (identify high-latency/redundant transformations)".
router.post('/optimize-cost', async (req, res) => {
  try {
    const { workflows, transformations, sample_traces } = req.body;
    if (!workflows && !transformations) {
      return res.status(400).json({ error: 'workflows or transformations is required' });
    }
    const systemPrompt = `You are an integration cost optimizer. Identify redundant or high-latency steps and propose consolidations. Respond with strict JSON only of the form: {"recommendations": [{"target": <string>, "action": "merge|drop|cache|defer|rewrite", "expected_savings": <string>, "risk": "low|medium|high", "rationale": <string>}], "estimated_total_savings_pct": <number>, "warnings": [<strings>]}.`;
    const userMessage = `Workflows:\n${JSON.stringify(workflows || [], null, 2)}\n\nTransformations:\n${JSON.stringify(transformations || [], null, 2)}\n\nSample traces:\n${JSON.stringify(sample_traces || [], null, 2)}`;
    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error optimizing cost:', err);
    res.status(500).json({ error: err.message || 'Failed to optimize cost' });
  }
});

// Apply pass 4 mechanical: data-quality-rules generator
router.post('/data-quality-rules', async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your-openrouter-api-key-here') {
      return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured' });
    }
    const { schema, sample_records, business_rules, severity_thresholds } = req.body;
    if (!schema && !sample_records) {
      return res.status(400).json({ error: 'schema or sample_records is required' });
    }
    const systemPrompt = `You are a data quality engineer. Generate machine-checkable data-quality rules for an integration pipeline. Respond with strict JSON only of the form: {"rules": [{"id": <string>, "field": <string>, "type": "not_null|range|regex|enum|reference|freshness|distribution", "expression": <string>, "severity": "low|medium|high|critical", "rationale": <string>, "alert_threshold_pct": <number>}], "coverage_gaps": [<strings>], "monitoring_plan": <string>, "summary": <string>}.`;
    const userMessage = `Schema:\n${JSON.stringify(schema || null, null, 2)}\n\nSample records:\n${JSON.stringify(sample_records || [], null, 2)}\n\nBusiness rules:\n${JSON.stringify(business_rules || [], null, 2)}\n\nSeverity thresholds:\n${JSON.stringify(severity_thresholds || null, null, 2)}`;
    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error generating data-quality rules:', err);
    res.status(500).json({ error: err.message || 'Failed to generate data-quality rules' });
  }
});

// Apply pass 4 mechanical: schema alignment helper across CSV/JSON/Avro/Parquet
router.post('/schema-alignment', async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your-openrouter-api-key-here') {
      return res.status(503).json({ error: 'OPENROUTER_API_KEY is not configured' });
    }
    const { schemas, canonical_target, alignment_goals } = req.body;
    if (!Array.isArray(schemas) || schemas.length < 2) {
      return res.status(400).json({ error: 'schemas (array of 2+) is required' });
    }
    const systemPrompt = `You are a data integration architect specializing in multi-modal schema alignment (CSV, JSON, Avro, Parquet, Protobuf). Produce a canonical alignment plan and per-source field mappings. Respond with strict JSON only of the form: {"canonical_schema": [{"field": <string>, "type": <string>, "nullable": <bool>, "description": <string>}], "per_source_mappings": [{"source": <string>, "fields": [{"source_field": <string>, "canonical_field": <string>, "transformation": <string>, "confidence": "low|medium|high"}], "unmapped_source_fields": [<strings>], "missing_canonical_fields": [<strings>]}], "type_conversions": [<strings>], "warnings": [<strings>], "summary": <string>}.`;
    const userMessage = `Schemas (${schemas.length}):\n${JSON.stringify(schemas, null, 2)}\n\nCanonical target preference: ${canonical_target || 'derive automatically'}\nAlignment goals: ${JSON.stringify(alignment_goals || null)}`;
    const result = await callOpenRouter(systemPrompt, userMessage);
    res.json({ result });
  } catch (err) {
    console.error('Error in schema alignment:', err);
    res.status(500).json({ error: err.message || 'Failed to align schemas' });
  }
});

module.exports = router;
