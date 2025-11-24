import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all properties (filtered by role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    let query = 'SELECT * FROM properties WHERE 1=1';
    const params = [];

    if (role === 'owner') {
      query += ' AND owner_id = ?';
      params.push(userId);
    } else if (role === 'renter') {
      query += ' AND renter_id = ?';
      params.push(userId);
    } else if (role === 'broker') {
      query += ' AND broker_id = ?';
      params.push(userId);
    }

    const properties = await db.all(query, params);
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create property (Broker or Owner)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { address, owner_id, renter_id } = req.body;

    if (role !== 'broker' && role !== 'owner') {
      return res.status(403).json({ error: 'Only brokers and owners can create properties' });
    }

    const brokerId = role === 'broker' ? userId : req.body.broker_id;
    const ownerId = role === 'owner' ? userId : owner_id;

    const result = await db.run(
      'INSERT INTO properties (address, owner_id, renter_id, broker_id) VALUES (?, ?, ?, ?)',
      [address, ownerId, renter_id || null, brokerId]
    );

    res.status(201).json({ id: result.lastID, message: 'Property created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

