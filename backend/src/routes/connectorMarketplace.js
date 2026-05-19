// Connector marketplace with reviews and reproducible test suites.
const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

const listings = new Map();
const reviews = new Map();
const tests = new Map();

router.post('/listings', authMiddleware, (req, res) => {
  const { slug, name, description, version, manifest } = req.body;
  if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
  listings.set(slug, { slug, name, description, version: version || '0.1.0', manifest: manifest || {}, createdAt: new Date() });
  res.json(listings.get(slug));
});

router.get('/listings', authMiddleware, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const all = [...listings.values()].filter(l => !q || (l.name + l.description).toLowerCase().includes(q));
  res.json({ count: all.length, listings: all });
});

router.post('/reviews', authMiddleware, (req, res) => {
  const { slug, stars, body } = req.body;
  if (!slug || stars == null) return res.status(400).json({ error: 'slug and stars required' });
  const arr = reviews.get(slug) || [];
  arr.push({ stars: Math.max(1, Math.min(5, parseInt(stars))), body, by: req.user?.email, at: new Date() });
  reviews.set(slug, arr);
  res.json({ count: arr.length });
});

router.get('/reviews/:slug', authMiddleware, (req, res) => {
  const arr = reviews.get(req.params.slug) || [];
  const avg = arr.length ? arr.reduce((s, r) => s + r.stars, 0) / arr.length : null;
  res.json({ avgStars: avg, count: arr.length, reviews: arr });
});

router.post('/tests', authMiddleware, (req, res) => {
  const { slug, name, requestPayload, expected } = req.body;
  if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
  const arr = tests.get(slug) || [];
  arr.push({ id: arr.length + 1, name, requestPayload, expected, addedAt: new Date() });
  tests.set(slug, arr);
  res.json({ count: arr.length });
});

router.post('/tests/:slug/run', authMiddleware, async (req, res) => {
  const arr = tests.get(req.params.slug) || [];
  const { handlerUrl } = req.body;
  if (!handlerUrl) return res.status(400).json({ error: 'handlerUrl required' });
  const results = [];
  for (const t of arr) {
    try {
      const r = await fetch(handlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t.requestPayload)
      });
      const body = await r.json().catch(() => r.text());
      const pass = JSON.stringify(body).includes(JSON.stringify(t.expected || {}).slice(1, -1));
      results.push({ name: t.name, pass, body });
    } catch (e) {
      results.push({ name: t.name, pass: false, error: e.message });
    }
  }
  res.json({ ran: results.length, results });
});

module.exports = router;
