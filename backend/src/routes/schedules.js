const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/schedules
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schedules ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching schedules:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedules/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schedules WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching schedule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/schedules
router.post('/', async (req, res) => {
  try {
    const { name, workflow_id, cron_expression, description, status, last_run, next_run, timezone } = req.body;
    const result = await pool.query(
      `INSERT INTO schedules (name, workflow_id, cron_expression, description, status, last_run, next_run, timezone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()) RETURNING *`,
      [name, workflow_id, cron_expression, description, status || 'active', last_run, next_run, timezone || 'UTC']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating schedule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/schedules/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, workflow_id, cron_expression, description, status, last_run, next_run, timezone } = req.body;
    const result = await pool.query(
      `UPDATE schedules SET name = $1, workflow_id = $2, cron_expression = $3, description = $4,
       status = $5, last_run = $6, next_run = $7, timezone = $8, updated_at = NOW() WHERE id = $9 RETURNING *`,
      [name, workflow_id, cron_expression, description, status, last_run, next_run, timezone, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating schedule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    res.json({ message: 'Schedule deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting schedule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
