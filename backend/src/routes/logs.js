const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/logs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching logs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/logs/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM logs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching log:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/logs
router.post('/', async (req, res) => {
  try {
    const { action, resource_type, resource_id, user_id, details, level, ip_address } = req.body;
    const result = await pool.query(
      `INSERT INTO logs (action, resource_type, resource_id, user_id, details, level, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [action, resource_type, resource_id, user_id || req.user.id, details, level || 'info', ip_address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating log:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/logs/:id
router.put('/:id', async (req, res) => {
  try {
    const { action, resource_type, resource_id, user_id, details, level, ip_address } = req.body;
    const result = await pool.query(
      `UPDATE logs SET action = $1, resource_type = $2, resource_id = $3, user_id = $4,
       details = $5, level = $6, ip_address = $7 WHERE id = $8 RETURNING *`,
      [action, resource_type, resource_id, user_id, details, level, ip_address, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating log:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/logs/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Log not found' });
    }
    res.json({ message: 'Log deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting log:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
