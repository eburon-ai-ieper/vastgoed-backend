import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get schedules (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    let query = 'SELECT * FROM schedules WHERE 1=1';
    const params = [];

    if (role === 'renter') {
      query += ' AND renter_id = ?';
      params.push(userId);
    } else if (role === 'contractor') {
      query += ' AND contractor_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY scheduled_date ASC';

    const schedules = await db.all(query, params);
    res.json(schedules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

