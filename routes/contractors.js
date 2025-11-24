import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all active contractors (for owner selection)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const contractors = await db.all(`
      SELECT 
        c.id,
        c.user_id,
        c.company_name,
        c.specialties,
        c.rating,
        u.name,
        u.email,
        u.phone
      FROM contractors c
      JOIN users u ON c.user_id = u.id
      WHERE c.is_active = 1
    `);

    // Parse specialties JSON
    const parsed = contractors.map(c => ({
      ...c,
      specialties: c.specialties ? JSON.parse(c.specialties) : []
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get contractor by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const contractor = await db.get(`
      SELECT 
        c.*,
        u.name,
        u.email,
        u.phone
      FROM contractors c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    contractor.specialties = contractor.specialties ? JSON.parse(contractor.specialties) : [];
    res.json(contractor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

