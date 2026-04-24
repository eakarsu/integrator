const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/connectors
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM connectors ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching connectors:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/connectors/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM connectors WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connector not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching connector:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/connectors
router.post('/', async (req, res) => {
  try {
    const { name, provider, category, version, status, description, icon } = req.body;
    const result = await pool.query(
      `INSERT INTO connectors (name, provider, category, version, status, description, icon, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *`,
      [name, provider, category, version, status || 'available', description, icon]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating connector:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/connectors/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, provider, category, version, status, description, icon } = req.body;
    const result = await pool.query(
      `UPDATE connectors SET name = $1, provider = $2, category = $3, version = $4,
       status = $5, description = $6, icon = $7, updated_at = NOW() WHERE id = $8 RETURNING *`,
      [name, provider, category, version, status, description, icon, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connector not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating connector:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/connectors/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM connectors WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connector not found' });
    }
    res.json({ message: 'Connector deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting connector:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
