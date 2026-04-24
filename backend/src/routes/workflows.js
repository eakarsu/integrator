const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/workflows
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workflows ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching workflows:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/workflows/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workflows WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching workflow:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/workflows
router.post('/', async (req, res) => {
  try {
    const { name, description, status, trigger_type, steps_count, last_run, success_rate } = req.body;
    const result = await pool.query(
      `INSERT INTO workflows (name, description, status, trigger_type, steps_count, last_run, success_rate, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, description, status || 'draft', trigger_type, steps_count || 0, last_run, success_rate || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating workflow:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/workflows/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, description, status, trigger_type, steps_count, last_run, success_rate } = req.body;
    const result = await pool.query(
      `UPDATE workflows SET name = $1, description = $2, status = $3, trigger_type = $4,
       steps_count = $5, last_run = $6, success_rate = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, description, status, trigger_type, steps_count, last_run, success_rate, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating workflow:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/workflows/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM workflows WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({ message: 'Workflow deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting workflow:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
