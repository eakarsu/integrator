const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/connections
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM connections ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching connections:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/connections/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM connections WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching connection:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/connections
router.post('/', async (req, res) => {
  try {
    const { name, type, host, port, status, auth_type, description } = req.body;
    const result = await pool.query(
      `INSERT INTO connections (name, type, host, port, status, auth_type, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, type, host, port, status || 'active', auth_type, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating connection:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/connections/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, type, host, port, status, auth_type, description } = req.body;
    const result = await pool.query(
      `UPDATE connections SET name = $1, type = $2, host = $3, port = $4, status = $5,
       auth_type = $6, description = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, type, host, port, status, auth_type, description, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating connection:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/connections/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM connections WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json({ message: 'Connection deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting connection:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
