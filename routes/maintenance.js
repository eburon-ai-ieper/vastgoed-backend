import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification, logWorkflowStep } from '../utils/workflow.js';

const router = express.Router();

// Auto-schedule appointment (called automatically when contractor is selected)
const autoScheduleAppointment = async (requestId, request) => {
  try {
    // Schedule for 2 days from now at 10:00 AM (default)
    const scheduledDate = new Date();
    scheduledDate.setDate(scheduledDate.getDate() + 2);
    scheduledDate.setHours(10, 0, 0, 0);

    // Check if schedule already exists
    const existing = await db.get('SELECT id FROM schedules WHERE maintenance_request_id = ?', [requestId]);
    if (existing) {
      return; // Already scheduled
    }

    // Create schedule entry
    await db.run(
      `INSERT INTO schedules (maintenance_request_id, contractor_id, renter_id, scheduled_date, notes, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [requestId, request.contractor_id, request.renter_id, scheduledDate.toISOString(), 'Automatically scheduled - please confirm or reschedule if needed']
    );

    // Update request status
    await db.run('UPDATE maintenance_requests SET status = ? WHERE id = ?', ['scheduled', requestId]);

    // Log workflow step
    await logWorkflowStep(requestId, 'appointment_auto_scheduled', null, `Appointment automatically scheduled for ${scheduledDate.toLocaleString()}`);

    // Notify contractor
    await createNotification(
      request.contractor_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Appointment automatically scheduled for: ${scheduledDate.toLocaleString()}. Please confirm or contact broker to reschedule.`,
      requestId
    );

    // Notify renter
    await createNotification(
      request.renter_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Your maintenance request has been automatically scheduled for: ${scheduledDate.toLocaleString()}`,
      requestId
    );

    // Notify broker
    await createNotification(
      request.broker_id,
      'appointment_auto_scheduled',
      'Appointment Auto-Scheduled',
      `Appointment automatically scheduled for: ${request.title} on ${scheduledDate.toLocaleString()}. Review and adjust if needed.`,
      requestId
    );
  } catch (error) {
    console.error('Error auto-scheduling appointment:', error);
  }
};

// Get all maintenance requests (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    let query = 'SELECT * FROM maintenance_requests WHERE 1=1';
    const params = [];

    // Filter based on role
    if (role === 'renter') {
      query += ' AND renter_id = ?';
      params.push(userId);
    } else if (role === 'owner') {
      query += ' AND owner_id = ?';
      params.push(userId);
    } else if (role === 'broker') {
      query += ' AND broker_id = ?';
      params.push(userId);
    } else if (role === 'contractor') {
      query += ' AND contractor_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const requests = await db.all(query, params);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new maintenance request (Renter)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    
    if (role !== 'renter') {
      return res.status(403).json({ error: 'Only renters can create maintenance requests' });
    }

    const { property_id, title, description, category, priority } = req.body;

    // Get property details to find broker and owner
    const property = await db.get('SELECT owner_id, broker_id FROM properties WHERE id = ?', [property_id]);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Create maintenance request
    const result = await db.run(
      `INSERT INTO maintenance_requests 
       (property_id, renter_id, broker_id, owner_id, title, description, category, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [property_id, userId, property.broker_id, property.owner_id, title, description, category, priority || 'medium']
    );

    const requestId = result.lastID;

    // Log workflow step
    await logWorkflowStep(requestId, 'request_created', userId, 'Renter created maintenance request');

    // Notify broker (for visibility, but not required for workflow)
    await createNotification(
      property.broker_id,
      'new_maintenance_request',
      'New Maintenance Request',
      `New ${category} request from renter: ${title}. Workflow is automated - you can review if needed.`,
      requestId
    );

    // Log workflow step
    await logWorkflowStep(requestId, 'broker_notified', property.broker_id, 'Broker notified of new request');

    // AUTO: Notify owner immediately (skip manual broker step)
    await db.run(
      'UPDATE maintenance_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['notified_owner', requestId]
    );
    await logWorkflowStep(requestId, 'owner_notified', property.broker_id, 'Owner automatically notified of new request');
    await createNotification(
      property.owner_id,
      'new_maintenance_request',
      'New Maintenance Request',
      `New ${category} request: ${title}`,
      requestId
    );

    // AUTO: Try to auto-select contractor based on category
    const contractor = await db.get(`
      SELECT c.user_id, c.specialties
      FROM contractors c
      JOIN users u ON c.user_id = u.id
      WHERE c.is_active = 1
      AND c.specialties LIKE ?
      ORDER BY c.rating DESC
      LIMIT 1
    `, [`%${category}%`]);

    if (contractor) {
      // Auto-select contractor
      await db.run(
        'UPDATE maintenance_requests SET contractor_id = ?, status = ? WHERE id = ?',
        [contractor.user_id, 'contractor_selected', requestId]
      );
      await logWorkflowStep(requestId, 'contractor_auto_selected', null, `Contractor automatically selected based on category: ${category}`);
      await createNotification(
        contractor.user_id,
        'contractor_assigned',
        'New Assignment',
        `You have been automatically assigned to: ${title}`,
        requestId
      );

      // AUTO: Auto-schedule appointment when contractor is selected
      const requestData = await db.get('SELECT * FROM maintenance_requests WHERE id = ?', [requestId]);
      await autoScheduleAppointment(requestId, requestData);
    }

    const finalStatus = contractor ? 'scheduled' : 'notified_owner';
    const finalMessage = contractor 
      ? 'Maintenance request created. Contractor auto-selected and appointment auto-scheduled!'
      : 'Maintenance request created. Owner has been notified.';

    res.status(201).json({ 
      id: requestId, 
      message: finalMessage,
      status: finalStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Owner selects contractor (automates: owner → contractor selection)
router.post('/:id/select-contractor', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { id } = req.params;
    const { contractor_id } = req.body;

    if (role !== 'owner') {
      return res.status(403).json({ error: 'Only property owners can select contractors' });
    }

    // Verify request belongs to this owner
    const request = await db.get(
      'SELECT * FROM maintenance_requests WHERE id = ? AND owner_id = ?',
      [id, userId]
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found or access denied' });
    }

    // Update request with contractor
    await db.run(
      'UPDATE maintenance_requests SET contractor_id = ?, status = ? WHERE id = ?',
      [contractor_id, 'contractor_selected', id]
    );

    // Log workflow step
    await logWorkflowStep(id, 'contractor_selected', userId, `Owner selected contractor ${contractor_id}`);

    // Notify contractor
    await createNotification(
      contractor_id,
      'contractor_assigned',
      'New Assignment',
      `You have been assigned to: ${request.title}`,
      id
    );

    // Notify broker
    await createNotification(
      request.broker_id,
      'contractor_selected',
      'Contractor Selected',
      `Owner selected contractor for: ${request.title}`,
      id
    );

    // AUTO: Auto-schedule appointment when owner manually selects contractor
    const requestData = await db.get('SELECT * FROM maintenance_requests WHERE id = ?', [id]);
    await autoScheduleAppointment(id, requestData);

    res.json({ message: 'Contractor selected. Appointment has been automatically scheduled!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Broker shares available time slots with contractor (automates scheduling)
router.post('/:id/schedule', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { id } = req.params;
    const { scheduled_date, notes } = req.body;

    if (role !== 'broker') {
      return res.status(403).json({ error: 'Only brokers can schedule appointments' });
    }

    // Get request details
    const request = await db.get('SELECT * FROM maintenance_requests WHERE id = ? AND broker_id = ?', [id, userId]);

    if (!request) {
      return res.status(404).json({ error: 'Request not found or access denied' });
    }

    if (!request.contractor_id) {
      return res.status(400).json({ error: 'No contractor assigned to this request' });
    }

    // Create schedule entry
    const result = await db.run(
      `INSERT INTO schedules (maintenance_request_id, contractor_id, renter_id, scheduled_date, notes, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [id, request.contractor_id, request.renter_id, scheduled_date, notes || '']
    );

    // Update request status
    await db.run('UPDATE maintenance_requests SET status = ? WHERE id = ?', ['scheduled', id]);

    // Log workflow step
    await logWorkflowStep(id, 'appointment_scheduled', userId, `Scheduled for ${scheduled_date}`);

    // Notify contractor
    await createNotification(
      request.contractor_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Appointment scheduled for: ${scheduled_date}`,
      id
    );

    // Notify renter
    await createNotification(
      request.renter_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Your maintenance request has been scheduled for: ${scheduled_date}`,
      id
    );

    res.json({ 
      message: 'Appointment scheduled. Contractor and renter have been notified.',
      schedule_id: result.lastID
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single maintenance request
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const request = await db.get('SELECT * FROM maintenance_requests WHERE id = ?', [id]);
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Get workflow logs
    const logs = await db.all(
      'SELECT * FROM workflow_logs WHERE maintenance_request_id = ? ORDER BY created_at ASC',
      [id]
    );

    res.json({ ...request, workflow_logs: logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Broker notifies owner (updates status to notified_owner)
router.post('/:id/notify-owner', authenticateToken, async (req, res) => {
  try {
    const { role, userId } = req.user;
    const { id } = req.params;

    if (role !== 'broker') {
      return res.status(403).json({ error: 'Only brokers can notify owners' });
    }

    // Get request details
    const request = await db.get('SELECT * FROM maintenance_requests WHERE id = ? AND broker_id = ?', [id, userId]);

    if (!request) {
      return res.status(404).json({ error: 'Request not found or access denied' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Cannot notify owner. Current status is: ${request.status}` });
    }

    // Update status
    await db.run(
      'UPDATE maintenance_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['notified_owner', id]
    );

    // Log workflow step
    await logWorkflowStep(id, 'owner_notified', userId, 'Broker notified owner of maintenance request');

    // Notify owner
    await createNotification(
      request.owner_id,
      'new_maintenance_request',
      'New Maintenance Request',
      `New ${request.category} request: ${request.title}`,
      id
    );

    res.json({ message: 'Owner has been notified. Owner can now select a contractor.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update request status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.run(
      'UPDATE maintenance_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

