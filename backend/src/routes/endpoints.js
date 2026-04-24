const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/endpoints
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM endpoints ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching endpoints:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/endpoints/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM endpoints WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/endpoints
router.post('/', async (req, res) => {
  try {
    const { name, path, method, description, status, auth_required, rate_limit } = req.body;
    const result = await pool.query(
      `INSERT INTO endpoints (name, path, method, description, status, auth_required, rate_limit, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, path, method, description, status || 'active', auth_required !== false, rate_limit]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/endpoints/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, path, method, description, status, auth_required, rate_limit } = req.body;
    const result = await pool.query(
      `UPDATE endpoints SET name = $1, path = $2, method = $3, description = $4,
       status = $5, auth_required = $6, rate_limit = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, path, method, description, status, auth_required, rate_limit, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/endpoints/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM endpoints WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json({ message: 'Endpoint deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
