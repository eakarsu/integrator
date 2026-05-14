// AI-generated documentation per integration (auto-updated).
const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

// In-memory docs cache, keyed by integrationId.
const docs = new Map();

async function ai(messages, max = 1500) {
  if (!OPENROUTER_API_KEY) {
    const e = new Error('OPENROUTER_API_KEY not configured'); e.statusCode = 503; throw e;
  }
  const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: OPENROUTER_MODEL,
    messages,
    max_tokens: max,
    temperature: 0.3
  }, { headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });
  return r.data.choices?.[0]?.message?.content || '';
}

router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { integrationId, definition } = req.body;
    if (!integrationId || !definition) return res.status(400).json({ error: 'integrationId and definition required' });
    const md = await ai([
      { role: 'system', content: 'Produce technical documentation in Markdown: Overview, Auth, Endpoints, Examples, Error handling, Changelog.' },
      { role: 'user', content: JSON.stringify(definition).slice(0, 6000) }
    ]);
    docs.set(integrationId, { md, generatedAt: new Date() });
    res.json({ integrationId, doc: md });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

router.get('/:integrationId', authMiddleware, (req, res) => {
  const d = docs.get(req.params.integrationId);
  if (!d) return res.status(404).json({ error: 'no doc generated yet' });
  res.json({ integrationId: req.params.integrationId, ...d });
});

router.post('/refresh-all', authMiddleware, async (req, res) => {
  // Stub: a real impl would walk the integration registry and regenerate everything.
  res.json({ ok: true, note: 'Implement scan of integration registry and per-id /generate calls.' });
});

module.exports = router;
