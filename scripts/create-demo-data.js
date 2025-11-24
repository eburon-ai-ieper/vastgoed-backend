import db from '../database/db.js';
import bcrypt from 'bcryptjs';

const createDemoData = async () => {
  try {
    console.log('Creating comprehensive demo data...');
    console.log('Clearing existing demo data...');

    // Clear existing data (but keep structure)
    await db.run('DELETE FROM notifications');
    await db.run('DELETE FROM workflow_logs');
    await db.run('DELETE FROM schedules');
    await db.run('DELETE FROM maintenance_requests');
    await db.run('DELETE FROM properties');
    await db.run('DELETE FROM contractors');
    await db.run('DELETE FROM users WHERE email LIKE ?', ['%@demo.com']);

    const passwordHash = await bcrypt.hash('demo123', 10);

    // ===== CREATE USERS =====
    console.log('Creating users...');

    // Broker
    const broker1 = await getOrCreateUser('broker@partners-vastgoed.com', passwordHash, 'Partners & Vastgoed', 'broker', '+32');

    // Owner
    const owner1 = await getOrCreateUser('jeanpierre.callant@example.com', passwordHash, 'Jean Pierre Callant', 'owner', '+32');

    // Renter
    const renter1 = await getOrCreateUser('michaelvh89@hotmail.com', passwordHash, 'Michael Vander Haegen', 'renter', '+32');

    // Contractor
    const contractor1 = await getOrCreateUser('mvh@allroundworks.com', passwordHash, 'MVH - All round works', 'contractor', '+32');

    // Create contractor profile
    await createContractorIfNotExists(contractor1.id, 'MVH - All round works', ['plumbing', 'electrical', 'heating', 'structural', 'appliances']);

    // ===== CREATE PROPERTIES =====
    console.log('Creating properties...');

    const property1 = await createPropertyIfNotExists('Omlooptstraat 2B, 8900 Ieper', owner1.id, renter1.id, broker1.id);

    // ===== CREATE MAINTENANCE REQUESTS =====
    console.log('Creating maintenance requests...');

    // Request 1: Pending (just created)
    const request1 = await createMaintenanceRequest(
      property1.id,
      renter1.id,
      broker1.id,
      owner1.id,
      'Leaking faucet in kitchen',
      'The kitchen faucet has been leaking for 2 days. Water is dripping constantly.',
      'plumbing',
      'medium',
      'pending'
    );
    if (request1) {
      await logWorkflowStep(request1, 'request_created', renter1.id, 'Renter created maintenance request');
    }

    // Request 2: Owner notified, waiting for contractor selection
    const request2 = await createMaintenanceRequest(
      property1.id,
      renter1.id,
      broker1.id,
      owner1.id,
      'Broken heating system',
      'The heating stopped working yesterday. It\'s getting cold in the apartment.',
      'heating',
      'high',
      'notified_owner'
    );
    if (request2) {
      await logWorkflowStep(request2, 'request_created', renter1.id, 'Renter created maintenance request');
      await logWorkflowStep(request2, 'broker_notified', broker1.id, 'Broker notified of new request');
      await logWorkflowStep(request2, 'owner_notified', owner1.id, 'Owner notified of maintenance request');
    }

    // Request 3: Contractor selected, waiting for scheduling
    const request3 = await createMaintenanceRequest(
      property1.id,
      renter1.id,
      broker1.id,
      owner1.id,
      'Electrical outlet not working',
      'The outlet in the living room stopped working. No power.',
      'electrical',
      'medium',
      'contractor_selected',
      contractor1.id
    );
    if (request3) {
      await logWorkflowStep(request3, 'request_created', renter1.id, 'Renter created maintenance request');
      await logWorkflowStep(request3, 'broker_notified', broker1.id, 'Broker notified of new request');
      await logWorkflowStep(request3, 'owner_notified', owner1.id, 'Owner notified of maintenance request');
      await logWorkflowStep(request3, 'contractor_selected', owner1.id, `Owner selected contractor ${contractor1.id}`);
    }

    // Request 4: Scheduled appointment
    const request4 = await createMaintenanceRequest(
      property1.id,
      renter1.id,
      broker1.id,
      owner1.id,
      'Washing machine broken',
      'The washing machine makes loud noises and doesn\'t spin properly.',
      'appliances',
      'medium',
      'scheduled',
      contractor1.id
    );
    if (request4) {
      await logWorkflowStep(request4, 'request_created', renter1.id, 'Renter created maintenance request');
      await logWorkflowStep(request4, 'broker_notified', broker1.id, 'Broker notified of new request');
      await logWorkflowStep(request4, 'owner_notified', owner1.id, 'Owner notified of maintenance request');
      await logWorkflowStep(request4, 'contractor_selected', owner1.id, `Owner selected contractor ${contractor1.id}`);
      await logWorkflowStep(request4, 'appointment_scheduled', broker1.id, 'Appointment scheduled for 2025-11-25 14:00');

      // Create schedule for request4
      const scheduleDate = new Date('2025-11-25T14:00:00');
      await db.run(
        `INSERT INTO schedules (maintenance_request_id, contractor_id, renter_id, scheduled_date, notes, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [request4, contractor1.id, renter1.id, scheduleDate.toISOString(), 'Please bring replacement parts']
      );
    }

    // ===== CREATE NOTIFICATIONS =====
    console.log('Creating notifications...');

    // Notifications for broker1
    if (request1) await createNotification(broker1.id, 'new_maintenance_request', 'New Request', 'New plumbing request from Michael Vander Haegen', request1);
    if (request3) await createNotification(broker1.id, 'contractor_selected', 'Contractor Selected', 'Owner selected contractor for: Electrical outlet not working', request3);

    // Notifications for owner1
    if (request2) await createNotification(owner1.id, 'new_maintenance_request', 'New Request', 'New heating request from Michael Vander Haegen', request2);

    // Notifications for contractor1
    if (request3) await createNotification(contractor1.id, 'contractor_assigned', 'New Assignment', 'You have been assigned to: Electrical outlet not working', request3);

    // Notifications for contractor1
    if (request4) {
      await createNotification(contractor1.id, 'contractor_assigned', 'New Assignment', 'You have been assigned to: Washing machine broken', request4);
      await createNotification(contractor1.id, 'appointment_scheduled', 'Appointment Scheduled', 'Appointment scheduled for: 2025-11-25 14:00', request4);
    }

    // Notifications for renter1
    if (request4) await createNotification(renter1.id, 'appointment_scheduled', 'Appointment Scheduled', 'Your maintenance request has been scheduled for: 2025-11-25 14:00', request4);

    console.log('\n✅ Demo data created successfully!');
    console.log('\n📋 Accounts (password: demo123):');
    console.log('\n👔 Broker:');
    console.log('  - broker@partners-vastgoed.com (Partners & Vastgoed)');
    console.log('\n🏠 Owner:');
    console.log('  - jeanpierre.callant@example.com (Jean Pierre Callant)');
    console.log('\n👤 Renter:');
    console.log('  - michaelvh89@hotmail.com (Michael Vander Haegen)');
    console.log('  - Address: Omlooptstraat 2B, 8900 Ieper');
    console.log('\n🔧 Contractor:');
    console.log('  - mvh@allroundworks.com (MVH - All round works)');
    console.log('\n📦 Property:');
    console.log('  - Omlooptstraat 2B, 8900 Ieper');
    console.log('    Owner: Jean Pierre Callant');
    console.log('    Renter: Michael Vander Haegen');
    console.log('    Broker: Partners & Vastgoed');
    console.log('\n🔨 Maintenance Requests:');
    console.log('  - Request 1: Pending (Leaking faucet)');
    console.log('  - Request 2: Owner Notified (Broken heating)');
    console.log('  - Request 3: Contractor Selected (Electrical outlet)');
    console.log('  - Request 4: Scheduled (Washing machine)');
    console.log('\n✨ You can now test the full workflow!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating demo data:', error);
    process.exit(1);
  }
};

// Helper functions
async function getOrCreateUser(email, passwordHash, name, role, phone) {
  let user = await db.get('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) {
    const result = await db.run(
      'INSERT INTO users (email, password_hash, name, role, phone) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, name, role, phone]
    );
    user = { id: result.lastID };
  } else {
    // Update password for demo accounts to ensure it's correct
    await db.run(
      'UPDATE users SET password_hash = ?, name = ?, role = ?, phone = ? WHERE email = ?',
      [passwordHash, name, role, phone, email]
    );
  }
  return user;
}

async function createContractorIfNotExists(userId, companyName, specialties) {
  const existing = await db.get('SELECT id FROM contractors WHERE user_id = ?', [userId]);
  if (!existing) {
    await db.run(
      'INSERT INTO contractors (user_id, company_name, specialties, rating) VALUES (?, ?, ?, ?)',
      [userId, companyName, JSON.stringify(specialties), Math.random() * 2 + 3] // Rating between 3-5
    );
  }
}

async function createPropertyIfNotExists(address, ownerId, renterId, brokerId) {
  let property = await db.get('SELECT id FROM properties WHERE address = ?', [address]);
  if (!property) {
    const result = await db.run(
      'INSERT INTO properties (address, owner_id, renter_id, broker_id) VALUES (?, ?, ?, ?)',
      [address, ownerId, renterId, brokerId]
    );
    property = { id: result.lastID };
  }
  return property;
}

async function createMaintenanceRequest(propertyId, renterId, brokerId, ownerId, title, description, category, priority, status, contractorId = null) {
  const result = await db.run(
    `INSERT INTO maintenance_requests 
     (property_id, renter_id, broker_id, owner_id, contractor_id, title, description, category, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [propertyId, renterId, brokerId, ownerId, contractorId || null, title, description, category, priority, status]
  );

  if (!result || !result.lastID) {
    throw new Error(`Failed to create maintenance request: ${title}. Result: ${JSON.stringify(result)}`);
  }

  return result.lastID;
}

async function logWorkflowStep(requestId, step, actorId, details) {
  if (!requestId) {
    console.warn(`Skipping workflow log: requestId is null/undefined for step: ${step}`);
    return;
  }
  await db.run(
    'INSERT INTO workflow_logs (maintenance_request_id, step, actor_id, details) VALUES (?, ?, ?, ?)',
    [requestId, step, actorId || null, details]
  );
}

async function createNotification(userId, type, title, message, relatedRequestId = null) {
  await db.run(
    'INSERT INTO notifications (user_id, type, title, message, related_request_id) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, message, relatedRequestId]
  );
}

createDemoData();

