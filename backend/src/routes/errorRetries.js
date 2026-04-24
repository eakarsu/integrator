const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/error-retries
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM error_retries ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching error retries:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/error-retries/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM error_retries WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error retry policy not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching error retry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/error-retries
router.post('/', async (req, res) => {
  try {
    const { name, max_retries, backoff_strategy, delay_ms, description, status, applied_to } = req.body;
    const result = await pool.query(
      `INSERT INTO error_retries (name, max_retries, backoff_strategy, delay_ms, description, status, applied_to, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, max_retries || 3, backoff_strategy || 'exponential', delay_ms || 1000, description, status || 'active', applied_to]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating error retry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/error-retries/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, max_retries, backoff_strategy, delay_ms, description, status, applied_to } = req.body;
    const result = await pool.query(
      `UPDATE error_retries SET name = $1, max_retries = $2, backoff_strategy = $3, delay_ms = $4,
       description = $5, status = $6, applied_to = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, max_retries, backoff_strategy, delay_ms, description, status, applied_to, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error retry policy not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating error retry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/error-retries/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM error_retries WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Error retry policy not found' });
    }
    res.json({ message: 'Error retry policy deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting error retry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
