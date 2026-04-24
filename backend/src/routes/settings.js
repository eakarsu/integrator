const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings ORDER BY category, key');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/settings/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM settings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings
router.post('/', async (req, res) => {
  try {
    const { key, value, category, description, is_secret, updated_by } = req.body;
    const result = await pool.query(
      `INSERT INTO settings (key, value, category, description, is_secret, updated_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
      [key, value, category || 'general', description, is_secret || false, updated_by || req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating setting:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/:id
router.put('/:id', async (req, res) => {
  try {
    const { key, value, category, description, is_secret, updated_by } = req.body;
    const result = await pool.query(
      `UPDATE settings SET key = $1, value = $2, category = $3, description = $4,
       is_secret = $5, updated_by = $6, updated_at = NOW() WHERE id = $7 RETURNING *`,
      [key, value, category, description, is_secret, updated_by || req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/settings/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM settings WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ message: 'Setting deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting setting:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
