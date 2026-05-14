// Replay-and-fix agent for failed runs (proposes patch + re-runs).
const express = require('express');
const axios = require('axios');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

// In-memory run log (would normally come from logs table).
const runs = new Map();

router.post('/record', authMiddleware, (req, res) => {
  const { runId, input, error, stack } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId required' });
  runs.set(runId, { runId, input, error, stack, recordedAt: new Date() });
  res.json({ ok: true });
});

router.post('/diagnose/:runId', authMiddleware, async (req, res) => {
  const r = runs.get(req.params.runId);
  if (!r) return res.status(404).json({ error: 'run not found' });
  if (!OPENROUTER_API_KEY) return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured' });
  try {
    const out = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'Diagnose the run failure. Return JSON {"root_cause","suggested_patch":{"path":string,"diff":string},"safe_to_auto_apply":bool}.' },
        { role: 'user', content: JSON.stringify(r).slice(0, 6000) }
      ],
      max_tokens: 600
    }, { headers: { Authorization: `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });
    let parsed;
    try { parsed = JSON.parse(out.data.choices[0].message.content.match(/\{[\s\S]*\}/)[0]); } catch { parsed = { raw: out.data.choices[0].message.content }; }
    res.json(parsed);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

router.post('/replay/:runId', authMiddleware, async (req, res) => {
  const r = runs.get(req.params.runId);
  if (!r) return res.status(404).json({ error: 'run not found' });
  const { handlerUrl } = req.body;
  if (!handlerUrl) return res.status(400).json({ error: 'handlerUrl required' });
  try {
    const rr = await fetch(handlerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(r.input)
    });
    res.json({ status: rr.status, body: await rr.json().catch(() => rr.text()) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
