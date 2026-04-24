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

module.exports = router;
