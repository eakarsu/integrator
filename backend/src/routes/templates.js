const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM templates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/templates/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/templates
router.post('/', async (req, res) => {
  try {
    const { name, description, category, complexity, estimated_time, steps_count, downloads, rating } = req.body;
    const result = await pool.query(
      `INSERT INTO templates (name, description, category, complexity, estimated_time, steps_count, downloads, rating, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [name, description, category, complexity || 'beginner', estimated_time, steps_count || 0, downloads || 0, rating || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/templates/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, category, complexity, estimated_time, steps_count, downloads, rating } = req.body;
    const result = await pool.query(
      `UPDATE templates SET name = $1, description = $2, category = $3, complexity = $4,
       estimated_time = $5, steps_count = $6, downloads = $7, rating = $8, updated_at = NOW() WHERE id = $9 RETURNING *`,
      [name, description, category, complexity, estimated_time, steps_count, downloads, rating, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM templates WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
