import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.get('SELECT id, email, name, role, phone, created_at FROM users WHERE id = ?', [req.user.userId]);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

