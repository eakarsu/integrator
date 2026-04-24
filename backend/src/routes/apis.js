const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/apis
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apis ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching apis:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/apis/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM apis WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching api:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/apis
router.post('/', async (req, res) => {
  try {
    const { name, method, endpoint, description, status, rate_limit, version } = req.body;
    const result = await pool.query(
      `INSERT INTO apis (name, method, endpoint, description, status, rate_limit, version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, method, endpoint, description, status || 'active', rate_limit, version]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating api:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/apis/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, method, endpoint, description, status, rate_limit, version } = req.body;
    const result = await pool.query(
      `UPDATE apis SET name = $1, method = $2, endpoint = $3, description = $4, status = $5,
       rate_limit = $6, version = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, method, endpoint, description, status, rate_limit, version, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating api:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/apis/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM apis WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API not found' });
    }
    res.json({ message: 'API deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting api:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
