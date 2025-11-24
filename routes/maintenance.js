import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification, logWorkflowStep } from '../utils/workflow.js';
import crypto from 'crypto';

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

    // Notify renter
    await createNotification(
      request.renter_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Your maintenance request "${request.title}" has been automatically scheduled for: ${scheduledDate.toLocaleString()}`,
      requestId
    );

    // Notify owner
    await createNotification(
      request.owner_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Appointment automatically scheduled for maintenance request "${request.title}" on ${scheduledDate.toLocaleString()}`,
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

    // Notify contractor
    await createNotification(
      request.contractor_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Appointment automatically scheduled for: ${request.title} on ${scheduledDate.toLocaleString()}. Please confirm or contact broker to reschedule.`,
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

    const { property_id, title, description, category, priority, renter_available_times } = req.body;

    // Get property details to find broker and owner
    const property = await db.get('SELECT owner_id, broker_id FROM properties WHERE id = ?', [property_id]);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Generate unique token for owner contractor selection
    const selectionToken = crypto.randomBytes(32).toString('hex');

    // Create maintenance request
    const result = await db.run(
      `INSERT INTO maintenance_requests 
       (property_id, renter_id, broker_id, owner_id, title, description, category, priority, status, renter_available_times, selection_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'notified_owner', ?, ?)`,
      [property_id, userId, property.broker_id, property.owner_id, title, description, category, priority || 'medium', renter_available_times ? JSON.stringify(renter_available_times) : null, selectionToken]
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

    // Notify owner with link to select contractor
    await logWorkflowStep(requestId, 'owner_notified', property.broker_id, 'Owner notified of new request');
    
    const ownerSelectionLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/select-contractor/${selectionToken}`;
    await createNotification(
      property.owner_id,
      'new_maintenance_request',
      'New Maintenance Request',
      `New ${category} request: ${title}. Click the link in your email to select a contractor.`,
      requestId
    );

    res.status(201).json({ 
      id: requestId, 
      message: 'Maintenance request created. Owner has been notified and will receive an email with a link to select a contractor.',
      status: 'notified_owner'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get request by selection token (for public contractor selection link)
router.get('/select-contractor/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const request = await db.get('SELECT * FROM maintenance_requests WHERE selection_token = ?', [token]);
    
    if (!request) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    // Get contractors list
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

    const parsedContractors = contractors.map(c => ({
      ...c,
      specialties: c.specialties ? JSON.parse(c.specialties) : []
    }));

    res.json({ 
      request: {
        id: request.id,
        title: request.title,
        description: request.description,
        category: request.category,
        priority: request.priority,
        renter_available_times: request.renter_available_times ? JSON.parse(request.renter_available_times) : null
      },
      contractors: parsedContractors,
      token: token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Owner selects contractor via token (public endpoint)
router.post('/select-contractor/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { contractor_id } = req.body;

    const request = await db.get('SELECT * FROM maintenance_requests WHERE selection_token = ?', [token]);
    
    if (!request) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    // Update request with contractor
    const scheduleToken = crypto.randomBytes(32).toString('hex');
    await db.run(
      'UPDATE maintenance_requests SET contractor_id = ?, status = ?, selection_token = ? WHERE id = ?',
      [contractor_id, 'contractor_selected', scheduleToken, request.id]
    );

    // Log workflow step
    await logWorkflowStep(request.id, 'contractor_selected', request.owner_id, `Owner selected contractor ${contractor_id}`);

    // Get contractor info
    const contractor = await db.get('SELECT name, email FROM users WHERE id = ?', [contractor_id]);
    
    // Notify contractor with link to schedule
    const scheduleLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/schedule-appointment/${scheduleToken}`;
    await createNotification(
      contractor_id,
      'contractor_assigned',
      'New Assignment',
      `You have been assigned to: ${request.title}. Click the link in your email to schedule the appointment.`,
      request.id
    );

    // Notify renter
    await createNotification(
      request.renter_id,
      'contractor_selected',
      'Contractor Selected',
      `A contractor has been selected for your maintenance request: ${request.title}. The contractor will schedule an appointment soon.`,
      request.id
    );

    // Notify broker
    await createNotification(
      request.broker_id,
      'contractor_selected',
      'Contractor Selected',
      `Owner selected contractor for: ${request.title}`,
      request.id
    );

    res.json({ 
      message: 'Contractor selected successfully! Contractor will receive an email with a link to schedule the appointment.',
      scheduleLink: scheduleLink
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Owner selects contractor (authenticated endpoint - for UI)
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

    // Generate schedule token
    const scheduleToken = crypto.randomBytes(32).toString('hex');

    // Update request with contractor
    await db.run(
      'UPDATE maintenance_requests SET contractor_id = ?, status = ?, selection_token = ? WHERE id = ?',
      [contractor_id, 'contractor_selected', scheduleToken, id]
    );

    // Log workflow step
    await logWorkflowStep(id, 'contractor_selected', userId, `Owner selected contractor ${contractor_id}`);

    // Get contractor info
    const contractor = await db.get('SELECT name, email FROM users WHERE id = ?', [contractor_id]);
    
    // Notify contractor with link to schedule
    const scheduleLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/schedule-appointment/${scheduleToken}`;
    await createNotification(
      contractor_id,
      'contractor_assigned',
      'New Assignment',
      `You have been assigned to: ${request.title}. Click the link in your email to schedule the appointment.`,
      id
    );

    // Notify renter
    await createNotification(
      request.renter_id,
      'contractor_selected',
      'Contractor Selected',
      `A contractor has been selected for your maintenance request: ${request.title}. The contractor will schedule an appointment soon.`,
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

    res.json({ message: 'Contractor selected. Contractor will receive an email with a link to schedule the appointment.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get request by schedule token (for public appointment scheduling link)
router.get('/schedule-appointment/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const request = await db.get('SELECT * FROM maintenance_requests WHERE selection_token = ?', [token]);
    
    if (!request) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    if (!request.contractor_id) {
      return res.status(400).json({ error: 'No contractor assigned to this request' });
    }

    // Get renter info for available times
    const renter = await db.get('SELECT name, email FROM users WHERE id = ?', [request.renter_id]);
    
    res.json({ 
      request: {
        id: request.id,
        title: request.title,
        description: request.description,
        category: request.category,
        priority: request.priority,
        renter_available_times: request.renter_available_times ? JSON.parse(request.renter_available_times) : null,
        renter_name: renter.name
      },
      token: token
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Contractor schedules appointment via token (public endpoint)
router.post('/schedule-appointment/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { scheduled_date, notes } = req.body;

    const request = await db.get('SELECT * FROM maintenance_requests WHERE selection_token = ?', [token]);
    
    if (!request) {
      return res.status(404).json({ error: 'Invalid or expired link' });
    }

    if (!request.contractor_id) {
      return res.status(400).json({ error: 'No contractor assigned to this request' });
    }

    // Create schedule entry
    await db.run(
      `INSERT INTO schedules (maintenance_request_id, contractor_id, renter_id, scheduled_date, notes, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [request.id, request.contractor_id, request.renter_id, scheduled_date, notes || '']
    );

    // Update request status
    await db.run('UPDATE maintenance_requests SET status = ? WHERE id = ?', ['scheduled', request.id]);

    // Log workflow step
    await logWorkflowStep(request.id, 'appointment_scheduled', request.contractor_id, `Appointment scheduled for ${scheduled_date}`);

    // Notify renter
    await createNotification(
      request.renter_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Your maintenance request "${request.title}" has been scheduled for: ${scheduled_date}`,
      request.id
    );

    // Notify owner
    await createNotification(
      request.owner_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Appointment scheduled for maintenance request "${request.title}" on ${scheduled_date}`,
      request.id
    );

    // Notify broker
    await createNotification(
      request.broker_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Appointment scheduled for: ${request.title} on ${scheduled_date}`,
      request.id
    );

    // Notify contractor
    await createNotification(
      request.contractor_id,
      'appointment_scheduled',
      'Appointment Scheduled',
      `Appointment scheduled for: ${request.title} on ${scheduled_date}`,
      request.id
    );

    res.json({ message: 'Appointment scheduled successfully! All parties have been notified.' });
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

    // Get schedule information if appointment is scheduled
    const schedule = await db.get(
      'SELECT * FROM schedules WHERE maintenance_request_id = ? ORDER BY created_at DESC LIMIT 1',
      [id]
    );

    // Get renter information
    let renter = null;
    try {
      renter = await db.get(
        'SELECT id, name, email FROM users WHERE id = ?',
        [request.renter_id]
      );
    } catch (error) {
      console.error('Error fetching renter:', error);
    }

    // Get property information
    let property = null;
    if (request.property_id) {
      try {
        property = await db.get(
          'SELECT id, address FROM properties WHERE id = ?',
          [request.property_id]
        );
      } catch (error) {
        console.error('Error fetching property:', error);
      }
    }

    res.json({ 
      ...request, 
      workflow_logs: logs, 
      schedule: schedule || null,
      renter: renter || null,
      property: property || null
    });
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

