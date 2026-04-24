const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/transformations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transformations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transformations:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/transformations/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transformations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transformation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching transformation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/transformations
router.post('/', async (req, res) => {
  try {
    const { name, source_format, target_format, description, status, mapping_count } = req.body;
    const result = await pool.query(
      `INSERT INTO transformations (name, source_format, target_format, description, status, mapping_count, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING *`,
      [name, source_format, target_format, description, status || 'active', mapping_count || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating transformation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/transformations/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, source_format, target_format, description, status, mapping_count } = req.body;
    const result = await pool.query(
      `UPDATE transformations SET name = $1, source_format = $2, target_format = $3, description = $4,
       status = $5, mapping_count = $6, updated_at = NOW() WHERE id = $7 RETURNING *`,
      [name, source_format, target_format, description, status, mapping_count, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transformation not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating transformation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/transformations/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM transformations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transformation not found' });
    }
    res.json({ message: 'Transformation deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting transformation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
