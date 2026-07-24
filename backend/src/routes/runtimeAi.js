const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { asyncRoute, HttpError } = require('../errors');

const router = express.Router();

router.post('/integration-advice', auth, asyncRoute(async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt || prompt.length > 8000) throw new HttpError(400, 'INVALID_PROMPT', 'Prompt must contain 1 through 8000 characters');
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  const baseUrl = process.env.OPENROUTER_BASE_URL;
  if (!apiKey || !model || !baseUrl) throw new HttpError(503, 'AI_NOT_CONFIGURED', 'OpenRouter is not configured');

  const provider = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are a systems-integration reviewer. Return concise risks, evidence gaps, recommended next actions, uncertainty, and decisions requiring human approval.' },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!provider.ok) throw new HttpError(502, 'AI_PROVIDER_ERROR', `OpenRouter returned ${provider.status}`);
  const payload = await provider.json();
  const content = String(payload?.choices?.[0]?.message?.content || '').trim();
  const providerReceipt = {
    id: String(payload?.id || provider.headers.get('x-request-id') || ''),
    created: payload?.created ?? null,
    upstreamModel: String(payload?.model || model),
  };
  if (!content || !providerReceipt.id) throw new HttpError(502, 'AI_PROVIDER_ERROR', 'OpenRouter returned an incomplete response');
  const saved = await db.query(
    `INSERT INTO runtime_ai_results(tenant_id,user_id,prompt,content,provider,model,provider_receipt)
     VALUES($1,$2,$3,$4,'openrouter',$5,$6) RETURNING id`,
    [req.user.tenantId, req.user.id, prompt, content, model, providerReceipt],
  );
  res.json({ id: saved.rows[0].id, content, provider: 'openrouter', model, providerReceipt });
}));

module.exports = router;
