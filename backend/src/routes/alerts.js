const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/alerts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alerts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/alerts/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM alerts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching alert:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/alerts
router.post('/', async (req, res) => {
  try {
    const { name, condition, threshold, channel, status, severity, last_triggered } = req.body;
    const result = await pool.query(
      `INSERT INTO alerts (name, condition, threshold, channel, status, severity, last_triggered, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, condition, threshold, channel || 'email', status || 'active', severity || 'medium', last_triggered]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating alert:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/alerts/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, condition, threshold, channel, status, severity, last_triggered } = req.body;
    const result = await pool.query(
      `UPDATE alerts SET name = $1, condition = $2, threshold = $3, channel = $4,
       status = $5, severity = $6, last_triggered = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, condition, threshold, channel, status, severity, last_triggered, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating alert:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM alerts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ message: 'Alert deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting alert:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
