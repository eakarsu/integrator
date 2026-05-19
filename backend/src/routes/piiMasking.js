// PII detection / masking AI applied to transformations.
const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

const PATTERNS = [
  { name: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, mask: '[EMAIL]' },
  { name: 'phone', re: /\+?\d[\d \-().]{7,}\d/g, mask: '[PHONE]' },
  { name: 'ssn', re: /\b\d{3}-?\d{2}-?\d{4}\b/g, mask: '[SSN]' },
  { name: 'credit_card', re: /\b(?:\d[ -]*?){13,16}\b/g, mask: '[CC]' }
];

function maskText(text) {
  const findings = [];
  let masked = text;
  for (const p of PATTERNS) {
    const matches = (text || '').match(p.re) || [];
    if (matches.length) {
      findings.push({ type: p.name, count: matches.length });
      masked = masked.replace(p.re, p.mask);
    }
  }
  return { masked, findings };
}

router.post('/scan', authMiddleware, (req, res) => {
  const { text } = req.body;
  if (text == null) return res.status(400).json({ error: 'text required' });
  const out = maskText(String(text));
  res.json(out);
});

// POST /api/pii-masking/scan-record — apply masking to all string fields recursively.
router.post('/scan-record', authMiddleware, (req, res) => {
  function walk(v) {
    if (typeof v === 'string') return maskText(v).masked;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, vv]) => [k, walk(vv)]));
    return v;
  }
  res.json({ masked: walk(req.body.record || {}) });
});

// POST /api/pii-masking/ai-classify — use LLM to categorise borderline cases.
router.post('/ai-classify', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
    const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'Return JSON: {"pii_categories":[string],"recommended_action":"mask|redact|leave","explanation":string}' },
        { role: 'user', content: (text || '').slice(0, 4000) }
      ],
      max_tokens: 300
    }, { headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });
    res.json({ raw: r.data.choices?.[0]?.message?.content });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
