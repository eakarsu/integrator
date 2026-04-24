const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, status, department, last_login, avatar_url, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, status, department, last_login, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role, status, department, avatar_url } = req.body;
    const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('default123', 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, status, department, avatar_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id, name, email, role, status, department, avatar_url, created_at, updated_at`,
      [name, email, hashedPassword, role || 'viewer', status || 'active', department, avatar_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, email, password, role, status, department, avatar_url } = req.body;

    let result;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      result = await pool.query(
        `UPDATE users SET name = $1, email = $2, password = $3, role = $4, status = $5,
         department = $6, avatar_url = $7, updated_at = NOW() WHERE id = $8
         RETURNING id, name, email, role, status, department, avatar_url, created_at, updated_at`,
        [name, email, hashedPassword, role, status, department, avatar_url, req.params.id]
      );
    } else {
      result = await pool.query(
        `UPDATE users SET name = $1, email = $2, role = $3, status = $4,
         department = $5, avatar_url = $6, updated_at = NOW() WHERE id = $7
         RETURNING id, name, email, role, status, department, avatar_url, created_at, updated_at`,
        [name, email, role, status, department, avatar_url, req.params.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, name, email, role',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted', data: result.rows[0] });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
