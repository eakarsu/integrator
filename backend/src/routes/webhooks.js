const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/webhooks
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM webhooks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching webhooks:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webhooks/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM webhooks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching webhook:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webhooks
router.post('/', async (req, res) => {
  try {
    const { name, url, events, secret, status, retry_count, last_triggered, description } = req.body;
    const result = await pool.query(
      `INSERT INTO webhooks (name, url, events, secret, status, retry_count, last_triggered, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [name, url, events, secret, status || 'active', retry_count || 3, last_triggered, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating webhook:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/webhooks/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, url, events, secret, status, retry_count, last_triggered, description } = req.body;
    const result = await pool.query(
      `UPDATE webhooks SET name = $1, url = $2, events = $3, secret = $4,
       status = $5, retry_count = $6, last_triggered = $7, description = $8, updated_at = NOW() WHERE id = $9 RETURNING *`,
      [name, url, events, secret, status, retry_count, last_triggered, description, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating webhook:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM webhooks WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.json({ message: 'Webhook deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting webhook:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
