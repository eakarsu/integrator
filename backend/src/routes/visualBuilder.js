// Visual drag-drop workflow builder backed by existing engine.
const express = require('express');
const authMiddleware = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'visual_workflows');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

router.post('/save', authMiddleware, (req, res) => {
  const { name, graph } = req.body;
  if (!name || !graph) return res.status(400).json({ error: 'name and graph required' });
  const id = `vw_${Date.now()}`;
  const doc = { id, name, graph, savedAt: new Date() };
  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(doc, null, 2));
  res.json(doc);
});

router.get('/', authMiddleware, (_req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  res.json({
    workflows: files.map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')); }
      catch { return null; }
    }).filter(Boolean)
  });
});

router.get('/:id', authMiddleware, (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${req.params.id}.json`), 'utf8')));
  } catch {
    res.status(404).json({ error: 'workflow not found' });
  }
});

// POST /api/visual-builder/:id/compile — turn the visual graph into the engine workflow shape.
router.post('/:id/compile', authMiddleware, (req, res) => {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${req.params.id}.json`), 'utf8'));
    const graph = doc.graph || {};
    const compiled = {
      id: doc.id,
      name: doc.name,
      steps: (graph.nodes || []).map((n, i) => ({
        id: n.id || `step_${i}`,
        type: n.type || 'noop',
        connector: n.connector,
        action: n.action,
        params: n.params || {},
        next: (graph.edges || []).filter(e => e.from === n.id).map(e => e.to)
      }))
    };
    res.json(compiled);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
